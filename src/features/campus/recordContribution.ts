import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useDemoStore } from '@/features/demo/demoMode'
import {
  evaluateContribution,
  normalizeLedger,
  CONTRIBUTION_LABEL,
  type ContributionLedger,
  type ContributionRejectReason,
} from './contribution'
import { getCampusMemberId } from './identity'
import { useCampusThemeStore } from './campusThemeStore'
import {
  applyAuthoritativeResult,
  getCampusRepository,
  initCampus,
  syncPendingCount,
  useCampusStore,
} from './campusStore'
import { enqueueOutbox, markOutboxRetry, resolveOutbox } from './outbox'
import { pushCampusFeedback } from './campusFeedback'
import { pickTargetTile } from './territory'
import type { CampusSubmitResult } from './repository'
import type { CampusContributionKind } from './types'

/**
 * 기여 이벤트 기록 — 유일한 진입점.
 *
 * 여기로 들어오는 값은 "성공했다는 사실"뿐입니다.
 * 자세 점수·좌표·`bad` 상태·카메라 데이터는 인자로 받지도, 저장하지도 않습니다.
 *
 * 저장소별 권위(§5):
 * - supabase: 서버가 단일 권위. 로컬 원장으로 선차단하지 않고
 *   (과거 mock 원장이 live 이벤트를 오판·차단하는 문제 제거),
 *   이벤트를 outbox 에 먼저 적재한 뒤 RPC 결과의 권위값을 즉시 반영합니다.
 *   일시 실패는 outbox 가 재전송합니다('queued').
 * - mock: 서버가 없으므로 로컬 원장(v2, source='mock')으로 상한·중복을
 *   판정합니다. 기존 v1 원장은 mock 원장으로 무손실 승계됩니다.
 */
export type ContributionSkipReason =
  | ContributionRejectReason
  | 'disabled'
  | 'demo_or_qa'
  | 'no_school'
  | 'no_membership'
  | 'invalid_kind'
  | 'session_required'
  | 'district_not_found'
  | 'not_ready'
  /** 일시 실패 — outbox 에 보관됐고 연결되면 자동 반영됩니다. */
  | 'queued'

export interface RecordResult {
  accepted: boolean
  points: number
  reason?: ContributionSkipReason
  tileId?: string
  captured?: boolean
}

/* ------------------------- mock 전용 로컬 원장 (v2) ------------------------ */

interface LedgerFileV2 {
  schemaVersion: 2
  source: 'mock'
  entries: ContributionLedger
}

let mockLedger: ContributionLedger | null = null

function readMockLedger(): ContributionLedger {
  if (!mockLedger) {
    const raw = loadLocal<unknown>(STORAGE_KEYS.campusLedger, null)
    if (
      raw &&
      typeof raw === 'object' &&
      (raw as Partial<LedgerFileV2>).schemaVersion === 2
    ) {
      mockLedger = normalizeLedger((raw as LedgerFileV2).entries)
    } else {
      // v1(버전 없음) → mock 원장으로 무손실 migration
      mockLedger = normalizeLedger(raw)
    }
  }
  return mockLedger
}

function writeMockLedger(next: ContributionLedger): void {
  mockLedger = next
  const file: LedgerFileV2 = { schemaVersion: 2, source: 'mock', entries: next }
  saveLocal(STORAGE_KEYS.campusLedger, file)
}

/** 테스트 전용 */
export function resetContributionLedgerForTest(): void {
  mockLedger = null
}

/* ------------------------------ 사용자 피드백 ----------------------------- */

const REJECT_FEEDBACK: Partial<Record<ContributionSkipReason, string>> = {
  no_school: '학교를 먼저 선택하면 기여가 반영돼요.',
  no_membership: '학교를 먼저 선택하면 기여가 반영돼요.',
  daily_cap: '오늘 최대 기여(600점)에 도달했어요. 내일 다시 반영돼요.',
  recovery_cap: '이번 세션의 회복 기여 상한(5회)에 도달했어요.',
  recovery_cooldown: '회복 기여는 20초 간격으로 반영돼요.',
  duplicate_event: '이미 반영된 기여예요.',
  duplicate_session: '이 세션의 기여는 이미 반영됐어요.',
  rate_limited: '짧은 시간에 너무 많은 이벤트가 들어왔어요.',
  invalid_kind: '반영할 수 없는 기여 종류예요.',
  session_required: '세션 정보가 없어 반영하지 못했어요.',
  district_not_found: '선택한 자치구를 찾지 못했어요. 화면을 새로고침해 주세요.',
}

function feedbackForResult(
  kind: CampusContributionKind,
  result: CampusSubmitResult,
  myTotal: number | undefined,
): void {
  if (result.accepted) {
    const action = result.captured
      ? '영토 점령'
      : result.contested
        ? '영토 공격'
        : result.tileId
          ? '영토 방어'
          : CONTRIBUTION_LABEL[kind]
    const total =
      typeof result.authoritativeMyContribution === 'number'
        ? result.authoritativeMyContribution
        : myTotal
    pushCampusFeedback({
      tone: 'success',
      title:
        typeof total === 'number'
          ? `내 기여도 ${total}점 · ${action} +${result.points}`
          : `${action} +${result.points}`,
    })
    return
  }
  if (result.reason && result.reason !== 'not_ready') {
    const message = REJECT_FEEDBACK[result.reason as ContributionSkipReason]
    if (message) {
      pushCampusFeedback({ tone: 'info', title: message })
    }
  }
}

function feedbackQueued(): void {
  pushCampusFeedback({
    tone: 'info',
    title: '기여를 보관했어요',
    description: '네트워크가 연결되면 자동으로 반영돼요.',
  })
}

/* --------------------------------- 기록 ---------------------------------- */

export interface RecordInput {
  kind: CampusContributionKind
  /** 중복 차단 키. 같은 성공에 대해 항상 같은 값이어야 합니다. */
  eventId: string
  sessionId: string | null
  at?: number
  /** 데모·QA 여부를 호출부가 알고 있으면 넘깁니다. */
  isDemo?: boolean
}

export async function recordCampusContribution(
  input: RecordInput,
): Promise<RecordResult> {
  if (!featureFlags.campusTerritory) return { accepted: false, points: 0, reason: 'disabled' }

  // 데모·QA 세션은 기여도가 없습니다.
  const isDemo = input.isDemo ?? useDemoStore.getState().isDemo
  if (isDemo) return { accepted: false, points: 0, reason: 'demo_or_qa' }

  const schoolId = useCampusThemeStore.getState().schoolId
  if (!schoolId) return { accepted: false, points: 0, reason: 'no_school' }

  const at = input.at ?? Date.now()

  if (!getCampusRepository()) await initCampus()
  const repository = getCampusRepository()

  if (repository?.kind === 'supabase') {
    return recordToSupabase(input, schoolId, at)
  }
  return recordToMock(input, schoolId, at)
}

/** supabase 경로 — 서버 권위 + outbox (§5-B/C) */
async function recordToSupabase(
  input: RecordInput,
  schoolId: string,
  at: number,
): Promise<RecordResult> {
  const snapshot = useCampusStore.getState().snapshot
  const target = snapshot
    ? pickTargetTile(snapshot.tiles, schoolId, useCampusThemeStore.getState().targetTileId)
    : null

  // 이벤트 생성 즉시 durable outbox — 어떤 실패에도 유실되지 않습니다.
  enqueueOutbox({
    eventId: input.eventId,
    kind: input.kind,
    sessionId: input.sessionId,
    targetTileId: target?.id ?? null,
    occurredAt: at,
  })
  syncPendingCount()

  const repository = getCampusRepository()
  if (!repository) {
    feedbackQueued()
    return { accepted: false, points: 0, reason: 'queued' }
  }

  const result = await repository.submitContribution({
    eventId: input.eventId,
    kind: input.kind,
    seasonId: snapshot?.season.id ?? '',
    schoolId,
    memberId: getCampusMemberId(),
    sessionId: input.sessionId,
    tileId: target?.id ?? '',
    points: 0,
    occurredAt: at,
  })

  if (result.accepted) {
    resolveOutbox(input.eventId)
    applyAuthoritativeResult(result)
    feedbackForResult(input.kind, result, undefined)
    return {
      accepted: true,
      points: result.points,
      tileId: result.tileId,
      captured: result.captured,
    }
  }

  if (result.reason && result.reason !== 'not_ready') {
    // 영구 거절 — 서버가 판정했으므로 로컬도 그대로 종료합니다.
    resolveOutbox(input.eventId)
    syncPendingCount()
    feedbackForResult(input.kind, result, undefined)
    return {
      accepted: false,
      points: 0,
      reason: result.reason as ContributionSkipReason,
    }
  }

  // 일시 실패 — outbox 유지, 다음 트리거(online·reconnect·화면 진입)에서 재시도
  markOutboxRetry(input.eventId, result.reason ?? 'network')
  syncPendingCount()
  feedbackQueued()
  return { accepted: false, points: 0, reason: 'queued' }
}

/** mock 경로 — 로컬 원장이 상한·중복을 판정합니다 (기존 동작 유지) */
async function recordToMock(
  input: RecordInput,
  schoolId: string,
  at: number,
): Promise<RecordResult> {
  const previous = readMockLedger()
  const decision = evaluateContribution(previous, {
    eventId: input.eventId,
    kind: input.kind,
    sessionId: input.sessionId,
    at,
  })
  if (!decision.accepted) {
    // 거절된 경우에도 rate-limit 창 정리는 반영합니다.
    writeMockLedger(decision.ledger)
    const result: RecordResult = { accepted: false, points: 0, reason: decision.reason }
    feedbackForResult(
      input.kind,
      { accepted: false, points: 0, reason: decision.reason },
      undefined,
    )
    return result
  }

  /*
    원장은 await 전에 동기적으로 확정합니다.
    두 이벤트가 거의 동시에 들어와도 같은 원장을 두 번 읽어 상한을 우회하지
    못하게 하는 것이 목적입니다. 저장소가 준비되지 않아 실제 반영에 실패하면
    아래에서 되돌립니다.
  */
  writeMockLedger(decision.ledger)
  const rollback = () => {
    if (mockLedger === decision.ledger) writeMockLedger(previous)
  }

  const repository = getCampusRepository()
  const snapshot = useCampusStore.getState().snapshot
  if (!repository || !snapshot) {
    rollback()
    return { accepted: false, points: 0, reason: 'not_ready' }
  }

  const target = pickTargetTile(
    snapshot.tiles,
    schoolId,
    useCampusThemeStore.getState().targetTileId,
  )
  if (!target) {
    rollback()
    return { accepted: false, points: 0, reason: 'not_ready' }
  }

  const result = await repository.submitContribution({
    eventId: input.eventId,
    kind: input.kind,
    seasonId: snapshot.season.id,
    schoolId,
    memberId: getCampusMemberId(),
    sessionId: input.sessionId,
    tileId: target.id,
    points: decision.points,
    occurredAt: at,
  })

  // 저장소가 아직 준비되지 않아 거절된 경우에만 되돌립니다.
  // 중복(duplicate_*)은 이미 반영된 것이므로 원장을 유지합니다.
  if (!result.accepted && result.reason === 'not_ready') rollback()

  if (result.accepted) {
    const myTotal = useCampusStore.getState().snapshot?.myContribution
    feedbackForResult(input.kind, result, (myTotal ?? 0) + result.points)
    useCampusStore.setState({ lastAcceptedAt: Date.now() })
  }

  return {
    accepted: result.accepted,
    points: result.points,
    reason: result.accepted ? undefined : (result.reason as ContributionSkipReason),
    tileId: result.tileId,
    captured: result.captured,
  }
}
