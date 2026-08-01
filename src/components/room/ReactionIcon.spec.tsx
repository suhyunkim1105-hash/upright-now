import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ReactionIcon } from './ReactionIcon'
import { REACTION_EMOJI, REACTION_LABEL } from '@/features/rooms/roomEvents'

/**
 * 반응 이모티콘 — 이미지 로드 실패 시 기존 이모지로 폴백해야 합니다.
 * (이미지가 없거나 네트워크가 막혀도 반응 기능이 죽지 않게)
 */
describe('ReactionIcon', () => {
  it('기본은 webp 이미지 + alt=라벨 + lazy 로딩', () => {
    render(<ReactionIcon kind="cheer" size={32} />)
    const img = screen.getByAltText(REACTION_LABEL.cheer) as HTMLImageElement
    expect(img.src).toContain('/assets/reactions/cheer-64.webp')
    // jsdom 은 loading 프로퍼티를 반영하지 않아 attribute 로 확인합니다.
    expect(img.getAttribute('loading')).toBe('lazy')
  })

  it('40px 초과면 128px 원본을 쓴다', () => {
    render(<ReactionIcon kind="goodnight" size={44} />)
    const img = screen.getByAltText(REACTION_LABEL.goodnight) as HTMLImageElement
    expect(img.src).toContain('/assets/reactions/goodnight-128.webp')
  })

  it('이미지 로드 실패 시 이모지로 폴백한다', () => {
    render(<ReactionIcon kind="coffee" size={32} />)
    const img = screen.getByAltText(REACTION_LABEL.coffee)
    fireEvent.error(img)
    expect(screen.queryByAltText(REACTION_LABEL.coffee)).toBeNull()
    expect(screen.getByText(REACTION_EMOJI.coffee)).toBeInTheDocument()
  })
})
