import type { PostureState, CharacterVisualState } from '@/types'

/**
 * 사용자에게 보이는 문구의 단일 소스 — docs/13_UX_COPY.md
 * 모든 표현은 "개인 기준 대비 변화"로 제한합니다. (docs/06 §16)
 */

export const BRAND = {
  name: 'Deskfit',
  slogan: '자세를 펴고, 오늘의 목표를 끝내는 시간',
  oneLiner:
    '노트북 공부 중 흐트러진 자세를 조용히 알아차리고, 회복할 때마다 캐릭터와 게임이 성장해요.',
} as const

export const PRIVACY = {
  title: '안심하고 사용하세요',
  body: '모든 영상은 기기 안에서만 분석되고 저장되지 않아요.',
  badges: ['내 기기 안에서 분석', '영상 저장 없음', '의료 진단 아님'],
  medical:
    '이 서비스는 의료 진단이나 치료를 제공하지 않아요. 불편이 지속되거나 심해지면 전문가와 상담을 고려해 주세요.',
} as const

interface PostureCopy {
  label: string
  message: string
  tone: 'green' | 'yellow' | 'coral' | 'muted' | 'blue'
  icon: string
  visual: CharacterVisualState
}

export const POSTURE_COPY: Record<PostureState, PostureCopy> = {
  good: {
    label: '편안함',
    message: '편안한 기준에 가까워요.',
    tone: 'green',
    icon: '✓',
    visual: 'idle',
  },
  warning: {
    label: '변화 감지',
    message: '자세가 조금 달라지고 있어요.',
    tone: 'yellow',
    icon: '•',
    visual: 'warning',
  },
  bad: {
    label: '회복 기회',
    message: '처음 등록한 기준으로 가볍게 돌아와 볼까요?',
    tone: 'coral',
    icon: '↺',
    visual: 'slouch',
  },
  away: {
    label: '자리 비움',
    message: '잠시 자리를 비웠어요. 돌아오면 측정을 이어갈게요.',
    tone: 'muted',
    icon: '⌾',
    visual: 'away',
  },
  unstable: {
    label: '측정 어려움',
    message: '측정하기 어려운 상태예요. 카메라 위치와 조명을 확인해 주세요.',
    tone: 'muted',
    icon: '⚠',
    visual: 'idle',
  },
}

export const RECOVERY_COPY = {
  inProgress: '좋아요. 편안한 기준으로 돌아오는 중이에요.',
  success: '자세를 회복했어요! 회복 에너지 발사!',
  missed: '이번 회복 기회는 지나갔어요. 다음에 다시 해봐요.',
} as const

export const QUALITY_COPY = {
  good: '측정 상태 좋음',
  // 노트북 웹캠은 엉덩이가 화면 밖인 것이 정상입니다. "불안정"이라고 쓰면
  // 편안히 앉아 있어도 항상 문제가 있는 것처럼 읽혀 limited 는
  // "측정은 계속되고 있다"가 전달되도록 씁니다.
  limited: '일부만 보여요 · 측정 계속',
  unavailable: '측정 불가',
} as const

export const AWAY_PROMPT = {
  title: '자리 비움이 길어지고 있어요. 세션을 계속할까요?',
  actions: ['계속하기', '일시정지', '세션 종료'],
} as const

export const STRETCH_SAFETY =
  '통증이나 어지럼증이 느껴지면 바로 멈춰 주세요. 이 안내는 의료 진단이나 치료를 대신하지 않아요.'

export const ROOM_PRIVACY =
  '친구에게는 닉네임, 진행 상태, 게임 이벤트만 보여요. 카메라와 개인 자세 상태는 공유하지 않아요.'

export const DEFAULT_NICKNAME = '익명의 기린'

/** 카메라를 아직 켜지 않은 빌드에서 보여주는 안내 */
export const CAMERA_DEMO_NOTICE =
  '현재 데모에서는 카메라 없이 자세 상태와 게임 흐름을 체험할 수 있어요.'

/** 친구 방을 아직 켜지 않은 빌드에서 보여주는 안내 */
export const FRIEND_ROOM = {
  ctaLabel: '친구 방 준비 중',
  toast: '친구와 함께하는 집중 방을 준비하고 있어요.',
  badge: '준비 중',
} as const

export const PREPARING_NOTICE =
  '이 화면은 아직 준비 중이에요. 지금은 대시보드와 집중 세션 흐름을 먼저 확인해 주세요.'

export const TARGET_PROGRESS_OPTIONS = [
  { id: 'done', label: '완료' },
  { id: 'mostly', label: '대부분 완료' },
  { id: 'half', label: '절반 정도' },
  { id: 'little', label: '조금 진행' },
] as const
