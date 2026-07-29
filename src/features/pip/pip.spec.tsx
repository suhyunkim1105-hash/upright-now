import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PipWidget } from './PipWidget'
import { MiniPostureWidget } from '@/components/session/MiniPostureWidget'
import { SessionCameraPreview } from '@/components/session/CameraStreamPreview'
import { closePip, isDocumentPipSupported, openPip } from './pipController'
import { usePipStore } from './pipStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import type { PostureState } from '@/types'

const MESSAGES: Record<PostureState, string> = {
  good: '편안한 기준에 가까워요.',
  warning: '자세가 조금 달라지고 있어요.',
  bad: '처음 등록한 기준으로 가볍게 돌아와 볼까요?',
  away: '잠시 자리를 비웠어요. 돌아오면 측정을 이어갈게요.',
  unstable: '측정하기 어려운 상태예요. 카메라 위치와 조명을 확인해 주세요.',
}

describe('PIP 미니 위젯 (멘토 피드백)', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
    usePipStore.getState().reset()
    usePostureStore.getState().reset()
    useSessionStore.getState().reset()
  })

  it('jsdom(미지원 환경)에서 openPip → unsupported + 화면 안 위젯 폴백', async () => {
    expect(isDocumentPipSupported()).toBe(false)

    useSessionStore.getState().start('pip-test')
    const result = await openPip()

    expect(result).toBe('unsupported')
    expect(usePipStore.getState().fallbackActive).toBe(true)
    // PiP 실패가 세션을 깨뜨리지 않는다
    expect(useSessionStore.getState().status).toBe('running')
  })

  it('closePip 은 폴백 상태를 정리하지만 세션은 유지한다', async () => {
    useSessionStore.getState().start('pip-test')
    await openPip()
    closePip()

    expect(usePipStore.getState().fallbackActive).toBe(false)
    expect(usePipStore.getState().pipOpen).toBe(false)
    expect(useSessionStore.getState().status).toBe('running')
  })

  it.each(Object.keys(MESSAGES) as PostureState[])(
    'PipWidget 이 %s 상태 문구를 표시한다',
    (state) => {
      usePostureStore.getState().setPostureState(state)
      render(<PipWidget onClose={() => {}} />)
      expect(screen.getByText(MESSAGES[state])).toBeInTheDocument()
    },
  )

  it('PipWidget은 현재 세션 스트림을 사용자가 열었을 때만 미리보기로 보여준다', () => {
    const stream = new EventTarget() as MediaStream
    render(<PipWidget onClose={() => {}} cameraStream={stream} />)

    expect(screen.getByRole('button', { name: '내 모습 보기' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.click(screen.getByRole('button', { name: '내 모습 보기' }))

    const video = screen.getByTestId('pip-camera-preview') as HTMLVideoElement
    expect(video).toBeVisible()
    expect(video.muted).toBe(true)
    expect(video.playsInline).toBe(true)
    expect(video.srcObject).toBe(stream)
  })

  it('세션 화면의 자기 모습 PiP는 기본 우측 하단의 펫 크기에서 열고 드래그할 수 있다', () => {
    const stream = new EventTarget() as MediaStream
    render(<SessionCameraPreview stream={stream} />)

    const open = screen.getByRole('button', { name: '내 모습 보기' })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(open)

    const preview = screen.getByTestId('session-camera-preview')
    expect(screen.getByTestId('session-camera-preview-video')).toHaveProperty('srcObject', stream)

    const handle = screen.getByRole('button', { name: '미리보기 위치 이동' })
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 80, clientY: 80 })
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 80, clientY: 80 })
    expect(preview).toHaveStyle({ transform: 'translate3d(-20px, -20px, 0)' })

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })
    expect(preview).toHaveStyle({ transform: 'translate3d(-36px, -20px, 0)' })
  })

  it('MiniPostureWidget 도 video 없이 상태·시간·콤보만 보여준다', () => {
    usePostureStore.getState().setPostureState('warning')
    const { container } = render(<MiniPostureWidget />)

    expect(screen.getByTestId('mini-posture-widget')).toBeInTheDocument()
    expect(screen.getByText(MESSAGES.warning)).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
  })

  it('자동 열기 토글 기본값은 꺼짐(사용자 직접 선택)', () => {
    expect(useUserStore.getInitialState().pipAutoOpen).toBe(false)
  })
})
