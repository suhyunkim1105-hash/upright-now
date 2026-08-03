import { describe, expect, it } from 'vitest'
import coopArenaSrc from './CoopArena.tsx?raw'
import uiSrc from '../ui/index.tsx?raw'

/**
 * 반응 버튼 레이아웃 가드.
 *
 * 전역 리셋이 img 를 display:block 으로 만들기 때문에, 이미지를 품는 버튼이
 * flex 컨테이너가 아니면 이미지가 한 줄을 차지하고 라벨이 버튼 밖 아래로
 * 밀려 다른 버튼과 겹칩니다. (2026-07-31 배포본에서 실제 발생)
 */

describe('CoopArena 반응 버튼', () => {
  it('이미지+라벨 버튼은 반드시 flex 로 가로 정렬한다', () => {
    // 반응 버튼(이미지 포함)과 커스텀 문구 버튼 모두.
    const buttonClassLines = coopArenaSrc
      .split('\n')
      .filter((l) => l.includes('h-8 items-center'))
    expect(buttonClassLines.length).toBeGreaterThanOrEqual(2)
    for (const line of buttonClassLines) {
      expect(line).toContain('inline-flex')
      expect(line).toContain('whitespace-nowrap')
    }
  })
})

describe('공용 Button 프리미티브', () => {
  it('아이콘+라벨이 한 줄을 유지한다 (inline-flex + nowrap)', () => {
    expect(uiSrc).toContain('inline-flex items-center justify-center')
    expect(uiSrc).toContain('whitespace-nowrap')
  })

  it('고정 높이가 아니라 min-h 라서 큰 아이콘도 밀려나지 않는다', () => {
    expect(uiSrc).toContain('min-h-9')
    expect(uiSrc).toContain('min-h-11')
    expect(uiSrc).toContain('min-h-14')
  })
})
