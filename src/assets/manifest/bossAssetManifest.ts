import { getBossPhase, type BossPhase } from '@/constants/game'

/**
 * 마감괴수 D-DAY 에셋 manifest.
 * 이미지 안에 텍스트(D-DAY·HP·시간)를 하드코딩하지 않습니다 — UI 가 표시합니다.
 * 파일이 없거나 로딩에 실패하면 기존 D-DAY 카드·아이콘 폴백을 유지합니다.
 */
const BASE = '/assets/bosses/d-day'

export const BOSS_ASSETS: Record<BossPhase, string> = {
  calm: `${BASE}/phase-01.webp`, // 61~100%
  angry: `${BASE}/phase-02.webp`, // 31~60%
  rage: `${BASE}/phase-03.webp`, // 1~30%
  defeated: `${BASE}/defeated.webp`, // 0%
}

export function resolveBossAsset(hp: number, maxHp: number): {
  phase: BossPhase
  src: string
} {
  const phase = getBossPhase(hp, maxHp)
  return { phase, src: BOSS_ASSETS[phase] }
}
