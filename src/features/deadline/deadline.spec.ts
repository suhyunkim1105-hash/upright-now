import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeStage,
  nextAlert,
  shouldDelayForRecovery,
  RECOVERY_DELAY_MS,
  DEADLINE_MESSAGES,
} from './deadlineLogic'
import { useDeadlineStore } from './deadlineStore'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { resolveBossAsset, BOSS_ASSETS } from '@/assets/manifest/bossAssetManifest'
import { sanitizeRoomEvent } from '@/features/rooms/roomEvents'

const MIN = 60_000

describe('마감 단계 계산 (V1.1)', () => {
  it('마감 없음 → 알림 없음 (기존 세션과 동일)', () => {
    expect(computeStage(1000, null)).toBeNull()
    expect(
      nextAlert({
        now: 1000,
        deadlineAt: null,
        enabled: true,
        completed: false,
        shownStages: [],
      }),
    ).toBeNull()
  })

  it.each([
    [16 * MIN, null],
    [15 * MIN, 't15'],
    [5 * MIN, 't5'],
    [1 * MIN, 't1'],
    [-1, 'overdue'],
  ] as const)('남은 %ims → %s', (remaining, stage) => {
    expect(computeStage(0, remaining)).toBe(stage)
  })

  it('각 임계 구간은 한 번만 표시된다', () => {
    const base = { deadlineAt: 15 * MIN, enabled: true, completed: false }
    const first = nextAlert({ ...base, now: 1, shownStages: [] })
    expect(first?.stage).toBe('t15')
    // 같은 구간 재확인 → 표시 없음
    expect(nextAlert({ ...base, now: 2, shownStages: ['t15'] })).toBeNull()
    // 다음 구간 진입 → t5 1회
    const t5 = nextAlert({ ...base, now: 10 * MIN + 1, shownStages: ['t15'] })
    expect(t5?.stage).toBe('t5')
  })

  it('완료 후에는 어떤 알림도 나오지 않는다', () => {
    expect(
      nextAlert({
        now: 20 * MIN,
        deadlineAt: 15 * MIN,
        enabled: true,
        completed: true,
        shownStages: [],
      }),
    ).toBeNull()
  })

  it('회복 중에는 최대 5초 지연 후 표시한다', () => {
    expect(shouldDelayForRecovery(false, 0, 1000)).toBe(false)
    expect(shouldDelayForRecovery(true, 1000, 1000 + RECOVERY_DELAY_MS - 1)).toBe(true)
    expect(shouldDelayForRecovery(true, 1000, 1000 + RECOVERY_DELAY_MS)).toBe(false)
  })

  it('금지 문구를 쓰지 않는다', () => {
    const all = Object.values(DEADLINE_MESSAGES)
      .map((m) => m.message)
      .join(' ')
    for (const banned of ['왜 아직', '또 미뤘', '게으르', '실패했', '포인트를 잃']) {
      expect(all).not.toContain(banned)
    }
  })
})

describe('deadlineStore (V1.1)', () => {
  beforeEach(() => {
    localStorage.clear()
    useDeadlineStore.getState().reset()
    useProgressionStore.setState({ xp: 100, points: 100 })
  })

  it('미루기는 마감을 옮기고 XP·포인트를 차감하지 않는다', () => {
    const store = useDeadlineStore.getState()
    store.configure('s1', Date.now() + 1 * MIN)
    const before = useDeadlineStore.getState().taskDeadlineAt!

    useDeadlineStore.getState().snooze(5)
    const after = useDeadlineStore.getState().taskDeadlineAt!
    expect(after - before).toBeGreaterThanOrEqual(5 * MIN - 50)

    useDeadlineStore.getState().snooze(15)
    useDeadlineStore.getState().snooze(60)
    // 보상·포인트 무변화 (처벌 없음)
    expect(useProgressionStore.getState().xp).toBe(100)
    expect(useProgressionStore.getState().points).toBe(100)
    // 60분 뒤 마감 → 어떤 임계 구간도 선반영되지 않음 (모든 단계가 다시 열림)
    expect(useDeadlineStore.getState().shownStages).toHaveLength(0)
  })

  it('5분 미루기 직후 같은 단계가 곧바로 다시 울리지 않는다', () => {
    useDeadlineStore.getState().configure('s1', Date.now() + 30_000)
    useDeadlineStore.getState().snooze(5)
    const s = useDeadlineStore.getState()
    // 기존 마감(30초 뒤)+5분 = 약 5분 30초 → t15 만 지나간 것으로 선반영
    expect(s.shownStages).toContain('t15')
    expect(s.shownStages).not.toContain('t1')
    expect(
      nextAlert({ now: Date.now(), deadlineAt: s.taskDeadlineAt, enabled: true, completed: false, shownStages: s.shownStages }),
    ).toBeNull()
  })

  it('shownStages 가 저장되어 새로고침·PIP 재생성에도 중복 표시가 없다', () => {
    useDeadlineStore.getState().configure('s1', Date.now() + MIN)
    useDeadlineStore.getState().markShown(DEADLINE_MESSAGES.t1)

    const raw = localStorage.getItem('upright-now:deadline')
    expect(raw).toContain('t1')
  })

  it('이번 세션에서 끄기 → 이후 알림 없음, 세션·측정에는 영향 없음', () => {
    useDeadlineStore.getState().configure('s1', Date.now() + MIN)
    useDeadlineStore.getState().disableForSession()
    expect(
      nextAlert({
        now: Date.now(),
        deadlineAt: useDeadlineStore.getState().taskDeadlineAt,
        enabled: useDeadlineStore.getState().alertsEnabled,
        completed: false,
        shownStages: [],
      }),
    ).toBeNull()
  })

  it('완료 → celebrate 패널 1회, 이후 알림 없음', () => {
    useDeadlineStore.getState().configure('s1', Date.now() + MIN)
    useDeadlineStore.getState().complete()
    expect(useDeadlineStore.getState().panel?.pose).toBe('celebrate')
    expect(useDeadlineStore.getState().completed).toBe(true)
  })
})

describe('보스 HP → 에셋 매핑 (V1.1)', () => {
  it.each([
    [2000, 'phase-01'],
    [1220, 'phase-01'], // 61%
    [1200, 'phase-02'], // 60%
    [620, 'phase-02'], // 31%
    [600, 'phase-03'], // 30%
    [20, 'phase-03'], // 1%
    [0, 'defeated'],
  ] as const)('HP %i → %s', (hp, file) => {
    expect(resolveBossAsset(hp, 2000).src).toContain(file)
  })

  it('모든 단계의 에셋 경로가 정의되어 있다', () => {
    expect(Object.keys(BOSS_ASSETS)).toHaveLength(4)
  })
})

describe('친구 방에 마감 데이터가 전송되지 않는다 (V1.1)', () => {
  it('taskDeadlineAt 이 섞인 payload 는 차단된다', () => {
    expect(
      sanitizeRoomEvent({
        id: 'e1',
        type: 'recovery_earned',
        participantId: 'p1',
        nickname: 'a',
        timestamp: 1,
        taskDeadlineAt: Date.now(),
      }),
    ).toBeNull()
  })
})
