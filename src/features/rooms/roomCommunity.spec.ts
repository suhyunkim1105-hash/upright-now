import { describe, expect, it, beforeEach } from 'vitest'
import {
  REACTION_EMOJI,
  REACTION_KINDS,
  REACTION_LABEL,
  sanitizeRoomEvent,
} from './roomEvents'
import { resolvePlayback } from '@/features/sound/soundEngine'
import { useUserStore } from '@/features/onboarding/userStore'

/**
 * 친구 방 커뮤니티 기능 — 반응 확장 + 방 안 소리 on/off.
 * DB 스키마 변경 없음. 기존 반응 3종의 동작은 그대로여야 합니다.
 */

describe('반응 목록', () => {
  it('8~10종이다', () => {
    expect(REACTION_KINDS.length).toBeGreaterThanOrEqual(8)
    expect(REACTION_KINDS.length).toBeLessThanOrEqual(10)
  })

  it('기존 3종이 그대로 남아 있고 문구도 바뀌지 않았다', () => {
    expect(REACTION_KINDS.slice(0, 3)).toEqual(['cheer', 'reset', 'done'])
    expect(REACTION_LABEL.cheer).toBe('조금만 더')
    expect(REACTION_LABEL.reset).toBe('같이 리셋하자')
    expect(REACTION_LABEL.done).toBe('나도 완료했어')
  })

  it('모든 반응에 라벨과 이모지가 있다', () => {
    for (const kind of REACTION_KINDS) {
      expect(REACTION_LABEL[kind]?.length ?? 0).toBeGreaterThan(0)
      expect(REACTION_EMOJI[kind]?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('중복된 종류가 없다', () => {
    expect(new Set(REACTION_KINDS).size).toBe(REACTION_KINDS.length)
  })
})

describe('반응 검증 — 허용 목록 밖은 차단', () => {
  const base = {
    id: 'r-1',
    type: 'reaction_sent' as const,
    participantId: 'p1',
    nickname: '기린',
    timestamp: 1000,
  }

  it('추가된 반응도 통과한다', () => {
    for (const kind of REACTION_KINDS) {
      expect(sanitizeRoomEvent({ ...base, reaction: kind })).not.toBeNull()
    }
  })

  it('목록 밖 값은 막는다', () => {
    expect(sanitizeRoomEvent({ ...base, reaction: 'hack' })).toBeNull()
    expect(sanitizeRoomEvent({ ...base, reaction: '' })).toBeNull()
  })

  it('자세 좌표 같은 금지 필드는 여전히 막는다', () => {
    expect(
      sanitizeRoomEvent({ ...base, reaction: 'cheer', postureState: 'bad' }),
    ).toBeNull()
  })
})

describe('방 안 소리 on/off', () => {
  beforeEach(() => {
    localStorage.clear()
    useUserStore.setState({ roomSoundMuted: false })
  })

  it('기본값은 소리 켜짐(음소거 아님)', () => {
    expect(useUserStore.getState().roomSoundMuted).toBe(false)
  })

  it('토글하면 뒤집힌다', () => {
    useUserStore.getState().toggleRoomSoundMuted()
    expect(useUserStore.getState().roomSoundMuted).toBe(true)
    useUserStore.getState().toggleRoomSoundMuted()
    expect(useUserStore.getState().roomSoundMuted).toBe(false)
  })

  it('방 음소거는 모드 설정보다 우선해 소리를 막는다', () => {
    const input = {
      event: 'recovery_success' as const,
      globalSoundOn: true,
      pack: 'social' as const,
      ctxRunning: true,
      now: 10_000,
    }
    // 평소에는 재생
    expect(resolvePlayback(input)).toBe(true)
    // 방에서 음소거하면 차단
    expect(resolvePlayback({ ...input, roomMuted: true })).toBe(false)
  })

  it('roomMuted 를 넘기지 않으면 기존 동작 그대로다 (회귀 방지)', () => {
    expect(
      resolvePlayback({
        event: 'recovery_success',
        globalSoundOn: false,
        pack: 'social',
        ctxRunning: true,
        now: 0,
      }),
    ).toBe(false)
  })
})
