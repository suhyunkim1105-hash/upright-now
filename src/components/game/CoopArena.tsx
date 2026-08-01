import { CharacterViewport } from '@/components/character/CharacterViewport'
import { MonsterViewport } from './MonsterViewport'
import { Icon } from '@/components/ui/Icon'
import { Progress } from '@/components/ui'
import { getShopItem } from '@/constants/storeItems'
import { MONSTER_THEMES } from '@/features/modes/modeStore'
import {
  REACTION_EMOJI,
  REACTION_KINDS,
  REACTION_LABEL,
} from '@/features/rooms/roomEvents'
import { sendReaction } from '@/features/rooms/roomService'
import { useRoomStore } from '@/features/rooms/roomStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import type { CharacterStage } from '@/types'

/**
 * 친구 방 공동 화면 — [내 캐릭터] [공동 괴물 + HP] [친구 캐릭터].
 *
 * 공유 표시: 닉네임·캐릭터 단계·장착 아이템·상태·attack/reaction 이벤트.
 * 자세 상태(good/bad)·이탈 시간·기준·좌표는 표시·전송하지 않습니다.
 * 친구 회복 공격(friendAttackTick)이 오면 친구 캐릭터가 괴물을 공격합니다.
 */
function GearBadges({
  jacketId,
  backpackId,
}: {
  jacketId?: string
  backpackId?: string
}) {
  const jacket = getShopItem(jacketId)
  const backpack = getShopItem(backpackId)
  if (!jacket && !backpack) return null
  return (
    <span className="mt-0.5 flex justify-center gap-1">
      {jacket && (
        <span
          title={jacket.name}
          className="h-3 w-3 rounded-full border border-white/70"
          style={{ backgroundColor: jacket.color }}
        />
      )}
      {backpack && (
        <span className="text-ink-soft">
          <Icon name={backpack.icon ?? 'bag'} size={12} />
        </span>
      )}
    </span>
  )
}

/** 참가자의 최근 반응(3초) 말풍선 */
function ReactionBubble({ participantId }: { participantId: string | null }) {
  const reactions = useRoomStore((s) => s.reactions)
  const latest = reactions.find(
    (r) => r.participantId === participantId && Date.now() - r.at < 3000,
  )
  if (!latest) return null
  return (
    <span
      data-testid="reaction-bubble"
      className="anim-toast-in absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-line bg-surface px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-ink shadow-card"
    >
      <span aria-hidden="true">{REACTION_EMOJI[latest.reaction]}</span>
      {latest.reactionText ?? REACTION_LABEL[latest.reaction]}
    </span>
  )
}

export function CoopArena({ bossHitTick }: { bossHitTick: number }) {
  const room = useRoomStore()
  const myStage = useCharacterStage()
  const equipped = useProgressionStore((s) => s.equipped)
  const nickname = useUserStore((s) => s.nickname)
  const customReactions = useUserStore((s) => s.customReactions)
  const snapshot = usePostureStore((s) => s.snapshot)
  const game = useGameStore()

  // 나를 제외한 참가자 전원 (2인 방이면 1명 — 기존과 동일)
  const friends = room.members.filter((m) => m.participantId !== room.myId)
  const theme = MONSTER_THEMES.komong
  const ratio = Math.max(0, room.bossHp / room.bossMaxHp)

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        {/* 내 캐릭터 — 내 화면에서만 내 자세가 반영됩니다 */}
        <div className="relative flex flex-col items-center">
          <ReactionBubble participantId={room.myId} />
          <CharacterViewport
            stage={myStage}
            postureState={snapshot.state}
            attackTick={game.attackTick}
            attackDurationMs={2200}
            size={150}
          />
          <p className="text-xs font-bold text-ink">{nickname}</p>
          <GearBadges jacketId={equipped.jacketId} backpackId={equipped.backpackId} />
        </div>

        {/* 공동 괴물 — 중앙 열 188px · 슬롯 132px · 괴물 116px (§9) */}
        <div className="flex w-[188px] flex-col items-center" data-testid="coop-boss">
          <div
            className={[
              'flex h-[132px] w-[132px] items-center justify-center rounded-2xl border-2',
              ratio <= 0 ? 'border-line bg-canvas' : 'border-coral campus-soft-bg',
            ].join(' ')}
            aria-hidden="true"
          >
            {ratio <= 0 ? (
              <span className="text-3xl">🎉</span>
            ) : (
              <MonsterViewport
                theme="komong"
                phase={1}
                hitTick={bossHitTick}
                size={116}
              />
            )}
          </div>
          <p className="mt-1 text-center text-xs font-bold text-ink">{theme.name}</p>
          <div className="mt-1 w-full">
            <Progress thick value={ratio} tone="coral" label={`${theme.name} 체력`} />
          </div>
          <p className="tabular mt-0.5 text-[11px] text-ink-soft">
            {`${Math.max(0, room.bossHp)} / ${room.bossMaxHp} · 방어막 ${room.shield}`}
          </p>
        </div>

        {/*
          함께하는 참가자 — 자세 상태 없이 idle + 공격 연출만.
          인원이 늘어나면 캐릭터를 작게 줄여 한 줄에 담습니다.
        */}
        <div className="relative flex flex-wrap items-end justify-center gap-x-3 gap-y-2">
          {friends.length > 0 ? (
            friends.map((friend) => (
              <div key={friend.participantId} className="relative flex flex-col items-center">
                <ReactionBubble participantId={friend.participantId} />
                <CharacterViewport
                  stage={Math.min(6, Math.max(1, friend.stage)) as CharacterStage}
                  attackTick={room.friendAttackTick}
                  attackDurationMs={2200}
                  size={friends.length > 3 ? 74 : friends.length > 1 ? 104 : 150}
                  decorative
                />
                <p className="max-w-[92px] truncate text-xs font-bold text-ink">
                  {friend.nickname}
                </p>
                {friends.length <= 3 && (
                  <GearBadges jacketId={friend.jacketId} backpackId={friend.backpackId} />
                )}
                <p className="text-[10px] text-ink-soft">
                  {friend.state === 'away'
                    ? '자리 비움'
                    : friend.state === 'completed'
                      ? '완주!'
                      : friend.state === 'resting'
                        ? '회복 휴식'
                        : '집중 중'}
                </p>
              </div>
            ))
          ) : (
            <p className="pb-8 text-xs font-bold text-coral">
              함께하던 참가자의 연결이 끊겼어요. 다시 접속을 기다리고 있어요.
            </p>
          )}
        </div>
      </div>

      {/* 정해진 반응만 보냅니다 — 5초에 1회, 자유 채팅 없음 */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {REACTION_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="h-8 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink hover:bg-canvas"
            onClick={() => void sendReaction(kind)}
          >
            <span aria-hidden="true">{REACTION_EMOJI[kind]}</span> {REACTION_LABEL[kind]}
          </button>
        ))}
        {customReactions.map((text) => (
          <button
            key={text}
            type="button"
            className="campus-soft-bg h-8 rounded-xl border border-[color:var(--campus-primary,var(--color-pink))]/40 px-2.5 text-xs font-semibold text-ink hover:bg-canvas"
            onClick={() => void sendReaction('cheer', text)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
