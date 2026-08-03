import { useUserStore } from '@/features/onboarding/userStore'
import { getActiveModeConfig } from '@/features/modes/modeStore'
import { isRoomSessionActive } from '@/features/rooms/roomStore'

/**
 * Web Audio 기반 짧은 효과음 엔진 — 외부 음원·저작권 파일 없음.
 *
 * 규칙 (docs 없음, 이 파일이 단일 출처):
 * - 배경 음악 자동 재생 금지. 짧은(≤0.35초) 알림음만.
 * - AudioContext 는 사용자 제스처(unlockAudio) 후에만 생성·재생.
 * - 설정의 전역 소리 OFF(userStore.soundEnabled=false)가 항상 최우선.
 * - 모드의 sound pack 이 포함하지 않는 이벤트는 재생하지 않음 (도서관=silent).
 * - 같은 이벤트는 짧은 간격 내 중복 재생하지 않음.
 *
 * SOUND_MANIFEST 가 "이벤트 → 소리" 경계입니다. 나중에 실제 음원 파일로
 * 교체할 때는 각 항목에 file 경로를 채우고 playSound 의 synth 분기만
 * file 재생으로 바꾸면 됩니다. (호출부는 변경 없음)
 */
export type SoundEventId =
  | 'session_start'
  | 'recovery_success'
  | 'boss_hit'
  | 'session_complete'
  | 'level_up'
  | 'friend_join'
  | 'friend_ready'
  | 'reaction_received'
  | 'giraffe_sync'
  | 'coop_attack'
  | 'monster_evolve'
  | 'session_last_minute'
  | 'session_pause'
  | 'session_resume'
  | 'stretch_complete'
  | 'item_purchase'
  | 'item_equip'
  | 'attendance_bonus'
  | 'friend_disconnect'
  | 'friend_reconnect'
  | 'friend_complete'
  | 'custom_reaction'
  | 'territory_contest'
  | 'territory_capture'
  | 'territory_defend'
  | 'season_end'

interface SoundSpec {
  /** 나중에 실제 음원으로 교체할 때 채우는 자리 (현재는 synth 사용) */
  file: string | null
  /** 짧은 신디사이저 톤: [주파수Hz, 시작 오프셋(초)] 목록 */
  tones: Array<[number, number]>
  durSec: number
  wave: OscillatorType
  gain: number
}

export const SOUND_MANIFEST: Record<SoundEventId, SoundSpec> = {
  session_start: { file: null, tones: [[440, 0], [660, 0.09]], durSec: 0.22, wave: 'sine', gain: 0.08 },
  recovery_success: { file: null, tones: [[523, 0], [784, 0.08]], durSec: 0.2, wave: 'triangle', gain: 0.09 },
  boss_hit: { file: null, tones: [[220, 0], [165, 0.06]], durSec: 0.16, wave: 'square', gain: 0.05 },
  session_complete: { file: null, tones: [[523, 0], [659, 0.1], [784, 0.2]], durSec: 0.34, wave: 'sine', gain: 0.09 },
  level_up: { file: null, tones: [[587, 0], [880, 0.12]], durSec: 0.28, wave: 'triangle', gain: 0.09 },
  friend_join: { file: null, tones: [[494, 0], [659, 0.08]], durSec: 0.2, wave: 'sine', gain: 0.07 },
  friend_ready: { file: null, tones: [[659, 0]], durSec: 0.14, wave: 'sine', gain: 0.07 },
  reaction_received: { file: null, tones: [[698, 0], [880, 0.07]], durSec: 0.18, wave: 'triangle', gain: 0.07 },
  giraffe_sync: { file: null, tones: [[523, 0], [659, 0.08], [880, 0.16]], durSec: 0.3, wave: 'triangle', gain: 0.09 },
  coop_attack: { file: null, tones: [[330, 0], [247, 0.07]], durSec: 0.18, wave: 'square', gain: 0.05 },
  monster_evolve: { file: null, tones: [[196, 0], [262, 0.1], [330, 0.2]], durSec: 0.34, wave: 'triangle', gain: 0.08 },
  session_last_minute: { file: null, tones: [[587, 0], [587, 0.12]], durSec: 0.24, wave: 'sine', gain: 0.07 },
  session_pause: { file: null, tones: [[440, 0], [330, 0.08]], durSec: 0.18, wave: 'sine', gain: 0.06 },
  session_resume: { file: null, tones: [[330, 0], [440, 0.08]], durSec: 0.18, wave: 'sine', gain: 0.06 },
  stretch_complete: { file: null, tones: [[494, 0], [587, 0.09]], durSec: 0.2, wave: 'triangle', gain: 0.08 },
  item_purchase: { file: null, tones: [[659, 0], [988, 0.08]], durSec: 0.2, wave: 'triangle', gain: 0.08 },
  item_equip: { file: null, tones: [[523, 0]], durSec: 0.12, wave: 'sine', gain: 0.07 },
  attendance_bonus: { file: null, tones: [[523, 0], [659, 0.09], [880, 0.18]], durSec: 0.3, wave: 'triangle', gain: 0.08 },
  friend_disconnect: { file: null, tones: [[392, 0], [294, 0.09]], durSec: 0.2, wave: 'sine', gain: 0.06 },
  friend_reconnect: { file: null, tones: [[294, 0], [392, 0.09]], durSec: 0.2, wave: 'sine', gain: 0.06 },
  friend_complete: { file: null, tones: [[523, 0], [784, 0.1]], durSec: 0.24, wave: 'triangle', gain: 0.08 },
  custom_reaction: { file: null, tones: [[740, 0], [932, 0.07]], durSec: 0.18, wave: 'triangle', gain: 0.07 },
  territory_contest: { file: null, tones: [[349, 0], [349, 0.1]], durSec: 0.22, wave: 'square', gain: 0.05 },
  territory_capture: { file: null, tones: [[440, 0], [554, 0.08], [659, 0.16]], durSec: 0.3, wave: 'triangle', gain: 0.08 },
  territory_defend: { file: null, tones: [[494, 0], [494, 0.09]], durSec: 0.2, wave: 'sine', gain: 0.07 },
  season_end: { file: null, tones: [[659, 0], [523, 0.12], [392, 0.24]], durSec: 0.4, wave: 'triangle', gain: 0.08 },
}

const SOFT_EVENTS: SoundEventId[] = [
  'session_start',
  'recovery_success',
  'boss_hit',
  'session_complete',
  'level_up',
  'monster_evolve',
  'session_last_minute',
  'session_pause',
  'session_resume',
  'stretch_complete',
  'item_purchase',
  'item_equip',
  'attendance_bonus',
  'territory_contest',
  'territory_capture',
  'territory_defend',
  'season_end',
]

export const PACK_EVENTS: Record<'silent' | 'soft' | 'social', SoundEventId[]> = {
  silent: [],
  soft: SOFT_EVENTS,
  social: [
    ...SOFT_EVENTS,
    'friend_join',
    'friend_ready',
    'reaction_received',
    'giraffe_sync',
    'coop_attack',
    'friend_disconnect',
    'friend_reconnect',
    'friend_complete',
    'custom_reaction',
  ],
}

/** 같은 이벤트 최소 재생 간격 — 중복 이벤트(리렌더·동시 수신) 방지 */
const MIN_INTERVAL_MS = 250

let ctx: AudioContext | null = null
const lastPlayedAt: Partial<Record<SoundEventId, number>> = {}

/** 사용자 제스처 핸들러 안에서만 호출 — 자동 재생 정책 준수 */
export function unlockAudio(): void {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
      return
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/**
 * 재생 여부 결정 — 순수 함수 (테스트 대상).
 * 전역 OFF > 팩 포함 여부 > 컨텍스트 준비 > 중복 간격 순서로 거릅니다.
 */
export function resolvePlayback(input: {
  event: SoundEventId
  globalSoundOn: boolean
  pack: 'silent' | 'soft' | 'social'
  ctxRunning: boolean
  now: number
  lastAt?: number
  /**
   * 친구 방 안에서 소리를 잠시 끈 상태.
   * 모드별 soundPack 설정을 바꾸지 않고 그 위에 덮습니다.
   */
  roomMuted?: boolean
}): boolean {
  if (input.roomMuted) return false
  if (!input.globalSoundOn) return false
  if (!PACK_EVENTS[input.pack].includes(input.event)) return false
  if (!input.ctxRunning) return false
  if (input.lastAt !== undefined && input.now - input.lastAt < MIN_INTERVAL_MS) {
    return false
  }
  return true
}

export function playSound(event: SoundEventId): void {
  const allowed = resolvePlayback({
    event,
    globalSoundOn: useUserStore.getState().soundEnabled,
    pack: getActiveModeConfig().soundPack,
    ctxRunning: ctx !== null && ctx.state === 'running',
    now: Date.now(),
    lastAt: lastPlayedAt[event],
    // 친구 방 세션 중에만 방 음소거를 적용합니다(개인 세션은 영향 없음).
    roomMuted: isRoomSessionActive() && useUserStore.getState().roomSoundMuted,
  })
  if (!allowed || !ctx) return
  lastPlayedAt[event] = Date.now()

  const spec = SOUND_MANIFEST[event]
  const t0 = ctx.currentTime
  const gainNode = ctx.createGain()
  gainNode.gain.setValueAtTime(0, t0)
  gainNode.gain.linearRampToValueAtTime(spec.gain, t0 + 0.015)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.durSec)
  gainNode.connect(ctx.destination)

  for (const [freq, offset] of spec.tones) {
    const osc = ctx.createOscillator()
    osc.type = spec.wave
    osc.frequency.setValueAtTime(freq, t0 + offset)
    osc.connect(gainNode)
    osc.start(t0 + offset)
    osc.stop(t0 + spec.durSec)
  }
}

/** 테스트 전용 — 컨텍스트·중복 기록 초기화 */
export function __resetSoundEngineForTest(fake?: AudioContext | null): void {
  ctx = fake ?? null
  for (const key of Object.keys(lastPlayedAt) as SoundEventId[]) {
    delete lastPlayedAt[key]
  }
}
