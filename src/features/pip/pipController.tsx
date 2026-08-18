import { createRoot, type Root } from 'react-dom/client'
import { PipWidget } from './PipWidget'
import { usePipStore } from './pipStore'

/**
 * Document Picture-in-Picture 컨트롤러.
 *
 * - requestWindow 는 사용자 제스처가 필요하므로, 세션 시작 버튼의
 *   click handler 안에서 openPip() 을 직접 호출해야 합니다.
 * - PiP 창은 오프너와 같은 JS 컨텍스트를 공유하므로 기존 zustand store 를
 *   그대로 구독합니다. 별도 타이머·엔진 없음.
 * - 사용자가 선택하면 현재 세션에서 이미 허용된 스트림만 미리보기로 연결합니다.
 *   새 getUserMedia 호출·캡처·저장·네트워크 전송은 하지 않습니다.
 * - PiP 가 닫혀도 세션은 계속됩니다. 새로고침 시 자동 복원하지 않습니다.
 */
interface DocumentPictureInPictureApi {
  requestWindow(options?: {
    width?: number
    height?: number
    disallowReturnToOpener?: boolean
    preferInitialWindowPlacement?: boolean
  }): Promise<Window>
  window: Window | null
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi
  }
}

let pipWindow: Window | null = null
let pipRoot: Root | null = null
let cameraStream: MediaStream | null = null

export function isDocumentPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

/** 오프너의 스타일시트를 PiP 문서로 복사합니다. */
function copyStyles(target: Window): void {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join('\n')
      const style = target.document.createElement('style')
      style.textContent = rules
      target.document.head.append(style)
    } catch {
      // 접근 불가(CORS) 스타일시트는 링크로 복제
      if (sheet.href) {
        const link = target.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.document.head.append(link)
      }
    }
  }
}

function cleanup(): void {
  const root = pipRoot
  pipRoot = null
  pipWindow = null
  cameraStream = null
  // React 렌더 사이클 중 동기 unmount 를 피하기 위해 다음 틱으로 미룹니다.
  if (root) {
    setTimeout(() => {
      try {
        root.unmount()
      } catch {
        // 이미 닫힌 창이면 무시
      }
    }, 0)
  }
  usePipStore.getState().patch({ pipOpen: false })
}

export type OpenPipResult = 'opened' | 'unsupported' | 'blocked'

function renderPipWidget(): void {
  if (!pipRoot || !pipWindow) return
  pipRoot.render(
    <PipWidget
      cameraStream={cameraStream}
      onClose={() => pipWindow?.close()}
      onFocusMain={() => {
        const opener = pipWindow?.opener
        if (opener && !opener.closed) opener.focus()
        else window.focus()
        pipWindow?.close()
      }}
    />,
  )
}

export function setPipCameraStream(stream: MediaStream | null): void {
  cameraStream = stream
  renderPipWidget()
}

/**
 * PiP 창을 엽니다 — 반드시 사용자 click handler 체인 안에서 호출하세요.
 * 실패해도 세션은 계속됩니다.
 */
export async function openPip(stream: MediaStream | null = null): Promise<OpenPipResult> {
  cameraStream = stream
  if (!isDocumentPipSupported() || !window.documentPictureInPicture) {
    usePipStore.getState().patch({ fallbackActive: true })
    return 'unsupported'
  }

  // 이미 열려 있으면 그대로 사용
  if (pipWindow && !pipWindow.closed) {
    renderPipWidget()
    return 'opened'
  }

  try {
    const win = await window.documentPictureInPicture.requestWindow({
      width: 300,
      height: 420,
      disallowReturnToOpener: true,
      preferInitialWindowPlacement: true,
    })
    pipWindow = win
    copyStyles(win)

    win.document.title = 'Deskfit'
    win.document.body.style.margin = '0'
    const container = win.document.createElement('div')
    container.style.height = '100vh'
    win.document.body.append(container)

    pipRoot = createRoot(container)
    renderPipWidget()

    // 사용자가 PiP 를 닫아도 세션은 종료하지 않습니다.
    win.addEventListener('pagehide', cleanup, { once: true })

    usePipStore.getState().patch({ pipOpen: true, fallbackActive: false })
    return 'opened'
  } catch {
    usePipStore.getState().patch({ fallbackActive: true })
    return 'blocked'
  }
}

/** 세션 완료·중단 시 호출 — PiP 를 자동으로 닫습니다. */
export function closePip(): void {
  if (pipWindow && !pipWindow.closed) {
    pipWindow.close()
  }
  cleanup()
  usePipStore.getState().patch({ fallbackActive: false })
}

/**
 * 선택 확장 — Chrome 자동 PiP.
 * Media Session 에 enterpictureinpicture 핸들러를 등록합니다.
 * 미지원 브라우저에서는 조용히 무시되며, 클릭 기반 PiP 와 무관하게 동작합니다.
 */
export function registerAutoPip(stream: MediaStream | null = null): void {
  try {
    if (!('mediaSession' in navigator)) return
    // 'enterpictureinpicture' 는 최신 Chrome 에서만 유효한 액션입니다.
    navigator.mediaSession.setActionHandler(
      'enterpictureinpicture' as MediaSessionAction,
      (details) => {
        const reason = (details as MediaSessionActionDetails & { reason?: string }).reason
        if (reason && reason !== 'contentoccluded') return
        void openPip(stream)
      },
    )
  } catch {
    // 액션 미지원 — 무시
  }
}
