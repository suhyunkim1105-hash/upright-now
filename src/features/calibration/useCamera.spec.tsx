import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useCamera } from './useCamera'

function makeTrack() {
  return {
    stop: vi.fn(),
    getSettings: () => ({ deviceId: 'cam-1' }),
    readyState: 'live' as const,
  }
}

function mockMediaDevices(getUserMedia: () => Promise<MediaStream>) {
  ;(navigator as unknown as { mediaDevices: unknown }).mediaDevices = {
    getUserMedia,
    enumerateDevices: async () => [
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Cam' } as MediaDeviceInfo,
    ],
  }
}

function harness(options?: { keepStreamOnUnmount?: boolean }) {
  return renderHook(() => {
    const ref = useRef<HTMLVideoElement>(document.createElement('video'))
    return useCamera(ref, options)
  })
}

afterEach(() => vi.restoreAllMocks())

describe('useCamera — 권한과 트랙 정지 (docs/14 §3)', () => {
  it('권한 허용 시 ready 상태가 된다', async () => {
    const track = makeTrack()
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
    mockMediaDevices(async () => stream as unknown as MediaStream)

    const { result } = harness()
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state.status).toBe('ready')
  })

  it('권한 거부 시 permission-denied 오류', async () => {
    mockMediaDevices(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })

    const { result } = harness()
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.state.status).toBe('error')
    expect(result.current.state.error).toBe('permission-denied')
  })

  it('장치 없음·사용 중 오류를 구분한다', async () => {
    mockMediaDevices(async () => {
      throw new DOMException('none', 'NotFoundError')
    })
    const a = harness()
    await act(async () => {
      await a.result.current.start()
    })
    expect(a.result.current.state.error).toBe('no-device')

    mockMediaDevices(async () => {
      throw new DOMException('busy', 'NotReadableError')
    })
    const b = harness()
    await act(async () => {
      await b.result.current.start()
    })
    expect(b.result.current.state.error).toBe('in-use')
  })

  it('stop() 은 모든 트랙을 정지한다', async () => {
    const track = makeTrack()
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
    mockMediaDevices(async () => stream as unknown as MediaStream)

    const { result } = harness()
    await act(async () => {
      await result.current.start()
    })
    act(() => result.current.stop())

    expect(track.stop).toHaveBeenCalled()
    expect(result.current.state.status).toBe('idle')
  })

  it('reuses the calibration stream in the session without a second getUserMedia call', async () => {
    const track = makeTrack()
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
    const getUserMedia = vi.fn(async () => stream as unknown as MediaStream)
    mockMediaDevices(getUserMedia)

    const calibration = harness({ keepStreamOnUnmount: true })
    await act(async () => {
      await calibration.result.current.start()
    })
    calibration.unmount()

    const session = harness()
    await act(async () => {
      await session.result.current.start()
    })

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(session.result.current.stream).toBe(stream)
    act(() => session.result.current.stop())
    expect(track.stop).toHaveBeenCalled()
  })
})
