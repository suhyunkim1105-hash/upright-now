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
  it('핵심 가치와 개인정보 안내를 보여준다', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('앉아 있는 시간은 그대로.')
    expect(screen.getByRole('heading', { name: /원본 영상은/ })).toBeInTheDocument()
    expect(screen.getByText('나만의 기준선')).toBeInTheDocument()
  })

  it('주 CTA가 기준 설정으로 이동한다', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getAllByRole('button', { name: /내 기준 자세 만들기/ })[0])

    expect(screen.getByText('기준 설정 화면')).toBeInTheDocument()
  })
})
