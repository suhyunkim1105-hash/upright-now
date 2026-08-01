import { useState } from 'react'
import {
  REACTION_EMOJI,
  REACTION_LABEL,
  type ReactionKind,
} from '@/features/rooms/roomEvents'

/**
 * 반응 캐릭터 이모티콘 — public/assets/reactions/<id>-{64,128}.webp.
 * 이미지를 불러오지 못하면 기존 이모지(REACTION_EMOJI)로 폴백합니다.
 * 표시 크기가 40px 를 넘으면 128px 원본을, 아니면 64px 원본을 씁니다.
 */
export function ReactionIcon({
  kind,
  size = 32,
}: {
  kind: ReactionKind
  size?: number
}) {
  const [broken, setBroken] = useState(false)

  if (broken) {
    return (
      <span
        aria-hidden="true"
        style={{ fontSize: Math.round(size * 0.75), lineHeight: 1 }}
      >
        {REACTION_EMOJI[kind]}
      </span>
    )
  }

  return (
    <img
      src={`/assets/reactions/${kind}-${size > 40 ? 128 : 64}.webp`}
      alt={REACTION_LABEL[kind]}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setBroken(true)}
      className="shrink-0 object-contain"
    />
  )
}
