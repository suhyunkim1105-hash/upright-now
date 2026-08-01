import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Landing } from './Landing'

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/landing']}>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/onboarding/name" element={<p>기준 설정 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  it('서비스 약속과 개인정보 원칙을 보여준다', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('집중은 이어가고,자세는 가볍게 돌아와요.')
    expect(screen.getByRole('heading', { name: /원본 영상과 스냅샷은/ })).toBeInTheDocument()
    expect(screen.getByText('카메라 프레임 외부 전송 없음')).toBeInTheDocument()
  })

  it('첫 화면 CTA가 기준 설정으로 이동시킨다', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getAllByRole('button', { name: /내 기준 만들기/ })[0])

    expect(screen.getByText('기준 설정 화면')).toBeInTheDocument()
  })
})
