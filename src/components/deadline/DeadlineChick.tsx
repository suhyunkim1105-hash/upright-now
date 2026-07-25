import { useState } from 'react'
import type { ChickPose } from '@/features/deadline/deadlineLogic'

/**
 * 마감순경 삐약 — 시간 알림 코치 캐릭터.
 * 실제 WebP 에셋(idle/notice/urgent/celebrate)이 있으면 사용하고,
 * 없으면 자체 제작 단순 SVG 병아리 폴백을 씁니다. (외부 캐릭터 복제 아님)
 */
const BASE = '/assets/characters/deadline-chick'

const POSE_SRC: Record<ChickPose, string> = {
  idle: `${BASE}/idle.webp`,
  notice: `${BASE}/notice.webp`,
  urgent: `${BASE}/urgent.webp`,
  celebrate: `${BASE}/celebrate.webp`,
}

/** 자체 제작 폴백 — 단순한 노랑 병아리 + 작은 모자 */
function ChickSvg({ pose }: { pose: ChickPose }) {
  const eyeY = pose === 'celebrate' ? 30 : 32
  const browTilt = pose === 'urgent' ? -3 : 0
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" role="presentation">
      {/* 몸통 */}
      <circle cx="32" cy="38" r="20" fill="#F7D64C" />
      <circle cx="32" cy="26" r="14" fill="#F9DE66" />
      {/* 모자 */}
      <path d="M 20 18 q 12 -9 24 0 l -2 4 q -10 -6 -20 0 z" fill="#1F3A5F" />
      <rect x="28" y="12" width="8" height="4" rx="1.5" fill="#1F3A5F" />
      {/* 눈 */}
      {pose === 'celebrate' ? (
        <>
          <path d="M 24 30 q 3 -3 6 0" stroke="#2b2b2b" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 34 30 q 3 -3 6 0" stroke="#2b2b2b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="27" cy={eyeY} r="2.4" fill="#2b2b2b" />
          <circle cx="37" cy={eyeY} r="2.4" fill="#2b2b2b" />
        </>
      )}
      {pose === 'urgent' && (
        <>
          <path d={`M 23 ${26 + browTilt} l 7 2`} stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" />
          <path d={`M 41 ${26 + browTilt} l -7 2`} stroke="#2b2b2b" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {/* 부리 */}
      <path d="M 29 36 l 3 3 l 3 -3 l -3 -2 z" fill="#F2994A" />
      {/* 날개 */}
      <path
        d={pose === 'celebrate' ? 'M 13 34 q -4 -8 4 -10' : 'M 14 40 q -5 4 0 9'}
        stroke="#E8C33C"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={pose === 'celebrate' ? 'M 51 34 q 4 -8 -4 -10' : 'M 50 40 q 5 4 0 9'}
        stroke="#E8C33C"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 발 */}
      <path d="M 26 57 v 4 M 38 57 v 4" stroke="#F2994A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function DeadlineChick({
  pose,
  size = 56,
}: {
  pose: ChickPose
  size?: number
}) {
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set())
  const src = POSE_SRC[pose]

  return (
    <span
      className="inline-block shrink-0"
      style={{ width: size, height: size }}
      data-chick-pose={pose}
    >
      {broken.has(src) ? (
        <ChickSvg pose={pose} />
      ) : (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-full w-full object-contain"
          onError={() => setBroken((prev) => new Set(prev).add(src))}
        />
      )}
    </span>
  )
}
