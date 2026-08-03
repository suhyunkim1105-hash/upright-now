import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle, Progress } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { ROOM_PRIVACY } from '@/constants/copy'
import { MAX_ROOM_MEMBERS, MIN_ROOM_MEMBERS } from '@/constants/rooms'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useRoomStore } from '@/features/rooms/roomStore'
import {
  joinRoom,
  leaveRoom,
  rejoinFromStorage,
  sendReaction,
  setMyState,
  startRoomSession,
} from '@/features/rooms/roomService'
import { useUserStore } from '@/features/onboarding/userStore'
import { useCalibrationStore, hasValidActiveProfile } from '@/features/calibration/calibrationStore'
import { DetectionPreflight } from '@/components/room/DetectionPreflight'
import { TextField } from '@/components/ui'
import { REACTION_KINDS, REACTION_LABEL } from '@/features/rooms/roomEvents'
import { ReactionIcon } from '@/components/room/ReactionIcon'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useToast } from '@/app/providers/ToastProvider'
import { CampusRoomBanner } from '@/components/campus/CampusBits'
import { Placeholder } from './Placeholder'
import { FRIEND_ROOM } from '@/constants/copy'
import type { CharacterStage } from '@/types'

/** S-08 친구 방 대기실 + 공동 세션 진입 */
export function Room() {
  const navigate = useNavigate()
  const { roomCode = '' } = useParams()
  const { push } = useToast()
  const room = useRoomStore()
  const configureSession = useSessionStore((s) => s.configure)
  const hasOnboarded = useUserStore((s) => s.hasOnboarded)
  const setNickname = useUserStore((s) => s.setNickname)
  const roomSoundMuted = useUserStore((s) => s.roomSoundMuted)
  const toggleRoomSoundMuted = useUserStore((s) => s.toggleRoomSoundMuted)
  const myProfiles = useCalibrationStore((s) => s.profiles)
  const validActiveProfile = useCalibrationStore((s) => hasValidActiveProfile(s))
  const [preflightOpen, setPreflightOpen] = useState(false)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const needNickname = !hasOnboarded && room.phase === 'idle'
  const startSession = useSessionStore((s) => s.start)

  // 링크 진입: 닉네임 확인 → 기존 참가자 재접속 우선 → 신규 입장.
  // running 방도 정원이 남아 있으면 신규 입장(중간 합류)이 됩니다.
  // 완료·만료된 방만 서버가 거부합니다.
  useEffect(() => {
    if (!featureFlags.friendRoom || needNickname) return
    if (room.phase === 'idle' && roomCode.length === 6) {
      void (async () => {
        const rejoined = await rejoinFromStorage(roomCode)
        if (!rejoined) void joinRoom(roomCode)
      })()
    }
  }, [room.phase, roomCode, needNickname])

  // 세션이 시작되면 개인 세션 화면으로 이동 (각자 기기에서 독립 분석)
  useEffect(() => {
    if (room.phase !== 'running') return
    // 중간 합류(또는 새로고침 복귀)면 방의 남은 시간만 계획합니다.
    // 개인 타이머를 새로 만들지 않고 방과 함께 끝나게 하기 위해서예요.
    const elapsedMs = room.startedAt ? Date.now() - room.startedAt : 0
    const midJoin = room.startedAt !== null && elapsedMs > 10_000
    configureSession({
      subject: room.subject,
      goal: room.goal,
      mode: 'room',
      lengthId:
        room.durationSec === 900
          ? '15'
          : room.durationSec === 3000
            ? '50'
            : room.durationSec === 1500
              ? '25'
              : 'custom',
      customFocusMin: Math.round(room.durationSec / 60),
      customRestMin: room.durationSec >= 3000 ? 5 : room.durationSec >= 1500 ? 2 : 1,
      ...(midJoin
        ? { plannedMsOverride: Math.max(0, room.durationSec * 1000 - elapsedMs) }
        : {}),
    })
    // 자세 기준이 없는 합류자는 자동 시작하지 않습니다. 세션 화면의 기존
    // 등록 안내(판정·보상 없는 관전 상태)를 그대로 거쳐 직접 시작합니다.
    if (featureFlags.camera && !validActiveProfile) {
      navigate(ROUTES.session(`room-${room.code}`))
      return
    }
    startSession(`room-${room.code}`)
    void setMyState('focusing')
    navigate(ROUTES.session(`room-${room.code}`))
  }, [room.phase, room.code, room.subject, room.goal, room.durationSec, room.startedAt, validActiveProfile, configureSession, startSession, navigate])

  if (!featureFlags.friendRoom) {
    return (
      <Placeholder
        title="친구 방 대기실"
        description={`6자리 코드로 최대 ${MAX_ROOM_MEMBERS}명이 함께 25분을 진행하는 공간이에요.`}
        notice={FRIEND_ROOM.toast}
      />
    )
  }

  const me = room.members.find((m) => m.participantId === room.myId)
  const fullyReady = (m: (typeof room.members)[number]) =>
    m.cameraReady && m.calibrationReady && m.modelReady && m.userReady
  // 2명 이상 · 참가자 전원 준비 완료여야 시작할 수 있습니다(서버도 같은 규칙).
  const everyoneReady =
    room.members.length >= MIN_ROOM_MEMBERS && room.members.every(fullyReady)
  const myPrereqOk = featureFlags.camera
    ? room.myCameraReady && room.myModelReady && validActiveProfile
    : true

  const copyInvite = async () => {
    const url = `${window.location.origin}/room/${room.code}`
    try {
      await navigator.clipboard.writeText(url)
      push({ title: '초대 링크를 복사했어요.', tone: 'success' })
    } catch {
      push({ title: url, tone: 'info' })
    }
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title={room.roomName || '친구 방'}
        description={ROOM_PRIVACY}
        back={() => {
          // 뒤로가기도 "나가기"와 같은 정리 경로를 타야 presence 가 남지 않습니다.
          void leaveRoom()
          navigate(ROUTES.roomNew)
        }}
        action={
          room.connection !== 'connected' ? (
            <Badge tone="coral">
              {room.connection === 'reconnecting' ? '다시 연결 중…' : '오프라인'}
            </Badge>
          ) : undefined
        }
      />

      {needNickname && (
        <Card>
          <CardTitle>어떻게 불러드릴까요?</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            친구 방에서 사용할 별명이에요. 입장 전에 정해 주세요.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="닉네임"
                id="room-nickname"
                maxLength={12}
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
              />
            </div>
            <Button onClick={() => setNickname(nicknameDraft)}>입장 계속</Button>
          </div>
        </Card>
      )}

      {/*
        캠퍼스 테마 배너 — 표시 전용입니다.
        친구 방 연결·Presence·Broadcast·보스 HP 로직은 건드리지 않습니다.
      */}
      <CampusRoomBanner />

      {room.phase === 'connecting' && (
        <Card>
          <p className="text-sm text-ink-soft">방에 연결하는 중이에요…</p>
        </Card>
      )}

      {room.phase === 'error' && (
        <Card tone="yellow">
          <p className="text-sm font-bold text-ink">{room.errorMessage}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void joinRoom(roomCode)}>
              다시 시도
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void leaveRoom()
                navigate(ROUTES.roomNew)
              }}
            >
              방 목록으로
            </Button>
          </div>
        </Card>
      )}

      {(room.phase === 'waiting' || room.phase === 'running') && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <Card tone="blue">
            <div className="flex items-center justify-between">
              <CardTitle>참가자</CardTitle>
              <Badge tone="blue">{`${room.members.length} / ${MAX_ROOM_MEMBERS}`}</Badge>
            </div>

            {/*
              참가자 카드 + 빈 자리 하나(정원이 남았을 때만).
              10명까지 늘어나도 열 수가 자동으로 늘어납니다.
            */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ...room.members.map((m) => m.participantId),
                ...(room.members.length < MAX_ROOM_MEMBERS ? ['__empty'] : []),
              ].map((slotKey) => {
                const member = room.members.find((m) => m.participantId === slotKey)
                if (!member) {
                  return (
                    <div
                      key={slotKey}
                      className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/60 text-sm text-ink-soft"
                    >
                      <Icon name="friends" />
                      친구를 기다리는 중…
                    </div>
                  )
                }
                return (
                  <div
                    key={member.participantId}
                    className="flex flex-col items-center gap-1 rounded-2xl bg-surface p-3"
                  >
                    <CharacterViewport
                      stage={Math.min(6, Math.max(1, member.stage)) as CharacterStage}
                      size={80}
                      decorative
                    />
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                      {member.nickname}
                      {member.isHost && <Badge tone="yellow">방장</Badge>}
                    </p>
                    <Badge tone={fullyReady(member) ? 'green' : 'muted'}>
                      {fullyReady(member)
                        ? '준비 완료'
                        : member.state === 'focusing'
                          ? '집중 중'
                          : '준비 중'}
                    </Badge>
                    <div className="mt-1 flex flex-wrap justify-center gap-1 text-[10px]">
                      {[
                        ['카메라', member.cameraReady],
                        ['자세 기준', member.calibrationReady],
                        ['모델', member.modelReady],
                        ['준비', member.userReady],
                      ].map(([label, ok]) => (
                        <span
                          key={String(label)}
                          className={
                            'rounded-full px-1.5 py-0.5 font-semibold ' +
                            (ok ? 'bg-green-soft text-green' : 'bg-canvas text-muted')
                          }
                        >
                          {ok ? '✓ ' : '· '}
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {featureFlags.camera && !myPrereqOk && (
              <div className="mt-4 rounded-2xl bg-surface/80 p-3 text-sm">
                <p className="font-bold text-ink">시작 전에 준비가 필요해요</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!(room.myCameraReady && room.myModelReady) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreflightOpen(true)}
                      disabled={preflightOpen}
                    >
                      카메라·감지 확인
                    </Button>
                  )}
                  {preflightOpen && (
                    <DetectionPreflight
                      onDone={(ok, message) => {
                        setPreflightOpen(false)
                        if (ok) {
                          void setMyState(me?.state === 'ready' ? 'ready' : 'joining')
                          push({ title: '카메라와 자세 감지가 준비됐어요.', tone: 'success' })
                        } else if (message) {
                          push({ title: message, tone: 'warning' })
                        }
                      }}
                    />
                  )}
                  {myProfiles.length === 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/calibration?return=/room/${room.code}`)}
                    >
                      자세 기준 등록
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={me?.state === 'ready' ? 'secondary' : 'primary'}
                disabled={!myPrereqOk}
                onClick={() =>
                  void setMyState(me?.state === 'ready' ? 'joining' : 'ready')
                }
              >
                {me?.state === 'ready' ? '준비 해제' : myPrereqOk ? '준비 완료' : '준비 전 단계 필요'}
              </Button>
              {room.isHost && (
                <Button
                  size="sm"
                  disabled={!everyoneReady}
                  onClick={() => void startRoomSession()}
                >
                  {everyoneReady
                    ? '세션 시작'
                    : room.members.length < MIN_ROOM_MEMBERS
                      ? `${MIN_ROOM_MEMBERS}명부터 시작할 수 있어요`
                      : '모두 준비되면 시작'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void leaveRoom()
                  navigate(ROUTES.home)
                }}
              >
                나가기
              </Button>
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardTitle>초대</CardTitle>
              <p className="mt-2 text-center">
                <span className="tabular rounded-xl bg-canvas px-4 py-2 text-2xl font-bold tracking-[0.3em] text-ink">
                  {room.code}
                </span>
              </p>
              <Button size="sm" fullWidth variant="secondary" className="mt-3" onClick={copyInvite}>
                초대 링크 복사
              </Button>
            </Card>

            <Card>
              <CardTitle>공동 팀플 괴물 꼬몽이</CardTitle>
              <div className="mt-3">
                <Progress
                  value={room.bossHp / room.bossMaxHp}
                  tone="pink"
                  label="팀플 괴물 꼬몽이 체력"
                  thick
                />
                <p className="mt-1 tabular text-xs text-ink-soft">
                  {`${room.bossHp} / ${room.bossMaxHp} · 방어막 ${room.shield}`}
                </p>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>응원 보내기</CardTitle>
                {/*
                  방 안에서만 소리를 잠시 끕니다.
                  모드별 소리 설정은 그대로 두고 방에 있는 동안만 덮어씁니다.
                */}
                <button
                  type="button"
                  data-testid="room-sound-toggle"
                  aria-pressed={roomSoundMuted}
                  onClick={toggleRoomSoundMuted}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 text-xs font-semibold text-ink hover:bg-canvas"
                >
                  <Icon name="headphones" size={14} />
                  {roomSoundMuted ? '방 소리 꺼짐' : '방 소리 켜짐'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {REACTION_KINDS.map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="secondary"
                    onClick={() => void sendReaction(kind)}
                  >
                    <ReactionIcon kind={kind} size={32} />
                    {REACTION_LABEL[kind]}
                  </Button>
                ))}
              </div>
              {roomSoundMuted && (
                <p className="mt-2 text-[11px] text-ink-soft">
                  이 방에서만 소리가 꺼져 있어요. 모드 설정은 그대로예요.
                </p>
              )}
              {room.reactions[0] && (
                <p className="mt-3 rounded-xl bg-canvas px-3 py-2 text-xs text-ink">
                  {`${room.reactions[0].nickname}: ${REACTION_LABEL[room.reactions[0].reaction]}`}
                </p>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  )
}
