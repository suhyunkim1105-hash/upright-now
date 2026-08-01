import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PipWidget } from './PipWidget'
import { MiniPostureWidget } from '@/components/session/MiniPostureWidget'
import { SessionCameraPanel } from '@/components/session/CameraStreamPreview'
import { closePip, isDocumentPipSupported, openPip } from './pipController'
import { usePipStore } from './pipStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useUserStore } from '@/features/onboarding/userStore'

describe('PiP session companion', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
    usePipStore.getState().reset()
    usePostureStore.getState().reset()
    useSessionStore.getState().reset()
  })

  it('keeps the session running when document PiP is unsupported', async () => {
    expect(isDocumentPipSupported()).toBe(false)
    useSessionStore.getState().start('pip-test')

    const result = await openPip()

    expect(result).toBe('unsupported')
    expect(usePipStore.getState().fallbackActive).toBe(true)
    expect(useSessionStore.getState().status).toBe('running')
  })

  it('cleans up PiP state without ending the session', async () => {
    useSessionStore.getState().start('pip-test')
    await openPip()
    closePip()

    expect(usePipStore.getState().fallbackActive).toBe(false)
    expect(usePipStore.getState().pipOpen).toBe(false)
    expect(useSessionStore.getState().status).toBe('running')
  })

  it('shows the baby turtle before the user opens the camera preview', () => {
    const stream = new EventTarget() as MediaStream
    const { container } = render(
      <PipWidget onClose={() => {}} onFocusMain={() => {}} cameraStream={stream} />,
    )

    expect(container.querySelector('.char-stage-1')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '내 모습 보기' }))

    const video = screen.getByTestId('pip-camera-preview') as HTMLVideoElement
    expect(video).toBeVisible()
    expect(video.srcObject).toBe(stream)
  })

  it('returns to the service tab through the explicit full-view control', () => {
    const onFocusMain = vi.fn()
    render(<PipWidget onClose={() => {}} onFocusMain={onFocusMain} />)

    fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))

    expect(onFocusMain).toHaveBeenCalledTimes(1)
  })

  it('shows the session camera in the main session panel', () => {
    const stream = new EventTarget() as MediaStream
    render(<SessionCameraPanel stream={stream} status="ready" />)

    expect(screen.getByTestId('session-camera-panel')).toBeInTheDocument()
    expect(screen.getByTestId('session-camera-panel-video')).toHaveProperty('srcObject', stream)
  })

  it('keeps the fallback mini widget free of raw camera video', () => {
    const { container } = render(<MiniPostureWidget />)

    expect(screen.getByTestId('mini-posture-widget')).toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
  })

  it('leaves the background companion preference opt-in by default', () => {
    expect(useUserStore.getInitialState().pipAutoOpen).toBe(false)
  })
})
