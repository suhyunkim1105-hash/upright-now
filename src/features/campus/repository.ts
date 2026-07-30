import type {
  CampusContributionEvent,
  CampusRealtimeStatus,
  CampusSchoolDirectoryEntry,
  CampusSnapshot,
  CampusTile,
} from './types'
import type { ContributionRejectReason } from './contribution'

/**
 * 캠퍼스 저장소 경계.
 *
 * 화면과 스토어는 이 인터페이스만 사용합니다.
 * mock(로컬) → Supabase 로 바꿀 때 화면 코드를 고치지 않아도 되도록,
 * 스냅샷 모양과 메서드 시그니처를 저장소 종류와 무관하게 고정합니다.
 */

/** 서버가 명시적으로 거절한 사유 (재시도해도 같은 결과 = 영구 거절) */
export type CampusPermanentReject =
  | ContributionRejectReason
  | 'no_membership'
  | 'invalid_kind'
  | 'session_required'

export interface CampusSubmitResult {
  accepted: boolean
  points: number
  /**
   * not_ready 만 일시(transient) — outbox 가 재시도합니다.
   * 나머지는 영구 거절로 outbox 에서 제거합니다.
   */
  reason?: CampusPermanentReject | 'not_ready'
  captured?: boolean
  contested?: boolean
  tileId?: string
  /** 서버가 계산한 이번 시즌 내 기여도 총점 (권위값) */
  authoritativeMyContribution?: number
  /** 서버가 반영 직후 돌려준 해당 영토 상태 */
  updatedTile?: CampusTile | null
  serverTime?: number
}

export interface CampusRepository {
  readonly kind: 'mock' | 'supabase'
  /** 현재 시즌 스냅샷 */
  load(): Promise<CampusSnapshot>
  /**
   * 실시간 반영. 같은 브라우저의 다른 탭 또는 다른 클라이언트의 변경을
   * 즉시 전달합니다. 해제 함수를 돌려줍니다.
   * onStatus 는 실제 구독 상태(SUBSCRIBED 확인 후 connected)를 알립니다.
   */
  subscribe(
    listener: (snapshot: CampusSnapshot) => void,
    onStatus?: (status: CampusRealtimeStatus, meta?: { lastEventAt?: number }) => void,
  ): () => void
  /** 원자적 기여 반영 + 타일 점령 판정 */
  submitContribution(event: CampusContributionEvent): Promise<CampusSubmitResult>
  /** 안전한 학교 디렉터리 (created_by 없음) */
  loadDirectory?(): Promise<CampusSchoolDirectoryEntry[]>
  /** 서버 membership 조회 — 다른 기기 복원용 */
  fetchMyMembership?(): Promise<{ schoolId: string } | null>
  /** 현재 이메일 인증 학교 — 원본 이메일은 반환하지 않습니다. */
  fetchMyVerification?(): Promise<import('./types').CampusVerification | null>
  requestSchoolVerification?(email: string): Promise<'sent' | 'invalid_email' | 'redirect_not_allowed' | 'rate_limited' | 'network_error' | 'unsupported'>
  confirmSchoolVerification?(
    schoolId: string,
  ): Promise<'verified' | 'domain_mismatch' | 'network_error' | 'unsupported'>
  /**
   * 서버 소속(membership) 동기화 — supabase 저장소에서만 의미가 있습니다.
   * mock 은 구현하지 않아도 됩니다(로컬 선택만 사용).
   */
  selectSchool?(
    schoolId: string,
  ): Promise<
    | 'selected' | 'changed' | 'unchanged'
    | 'change_limit' | 'change_cooldown' | 'verification_required' | 'not_ready'
  >
  dispose(): void
}
