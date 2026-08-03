import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, CardTitle, SegmentedControl, TextField } from '@/components/ui'
import { ROOM_PRIVACY } from '@/constants/copy'
import { clampCustomFocusMin } from '@/constants/session'
import { MAX_PERSISTENT_ROOMS } from '@/constants/rooms'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import {
  createRoom,
  joinRoom,
  listMyPersistentRooms,
  type MyPersistentRoom,
} from '@/features/rooms/roomService'
import { useRoomStore } from '@/features/rooms/roomStore'
import { Placeholder } from './Placeholder'
import { FRIEND_ROOM } from '@/constants/copy'

const DURATIONS = [
  { id: '1500', label: '25분', sublabel: '기본' },
  { id: '900', label: '15분', sublabel: '짧게' },
  { id: '3000', label: '50분', sublabel: '길게' },
]

/** S-07 친구 방 생성·입장 — 최대 2명, 카메라·자세 상태는 공유하지 않습니다 */
export function RoomNew() {
  const navigate = useNavigate()
  const errorMessage = useRoomStore((s) => s.errorMessage)
  const phase = useRoomStore((s) => s.phase)

  const [roomName, setRoomName] = useState('')
  const [subject, setSubject] = useState('')
  const [goal, setGoal] = useState('')
  const [durationId, setDurationId] = useState('1500')
  const [customMin, setCustomMin] = useState(25)
  const [joinCode, setJoinCode] = useState('')
  const [persistent, setPersistent] = useState(false)
  const [myRooms, setMyRooms] = useState<MyPersistentRoom[]>([])

  // 내 상시 방 재입장 진입점 — 목록이 비면 아무것도 보여주지 않습니다.
  useEffect(() => {
    let alive = true
    void listMyPersistentRooms().then((rooms) => {
      if (alive) setMyRooms(rooms)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!featureFlags.friendRoom) {
    return (
      <Placeholder
        title="친구 방 만들기"
        description="친구에게는 닉네임, 진행 상태, 게임 이벤트만 보여요. 카메라와 개인 자세 상태는 공유하지 않아요."
        notice={FRIEND_ROOM.toast}
      />
    )
  }

  const busy = phase === 'connecting'

  const submitCreate = async () => {
    const result = await createRoom({
      roomName,
      subject,
      goal,
      durationSec:
        durationId === 'custom'
          ? clampCustomFocusMin(customMin) * 60
          : Number(durationId),
      isPersistent: persistent,
    })
    if (result.ok && result.code) navigate(ROUTES.room(result.code))
  }

  const submitJoin = async () => {
    if (joinCode.trim().length < 6) return
    const result = await joinRoom(joinCode.trim())
    if (result.ok) navigate(ROUTES.room(joinCode.trim().toUpperCase()))
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="친구와 함께 25분을 시작해 볼까요?"
        description={ROOM_PRIVACY}
        back={ROUTES.home}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>방 만들기</CardTitle>
          <div className="mt-4 flex flex-col gap-3">
            <TextField
              label="방 이름"
              id="room-name"
              placeholder="예: 시험주간 스터디"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <TextField
              label="과목 또는 과제"
              id="room-subject"
              placeholder="예: 자료구조"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <TextField
              label="오늘 목표"
              id="room-goal"
              placeholder="예: 3장 문제 풀기"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-semibold text-ink">세션 길이</p>
              <SegmentedControl
                ariaLabel="세션 길이"
                columns={4}
                value={durationId}
                onChange={setDurationId}
                options={[...DURATIONS, { id: 'custom', label: '직접 설정', sublabel: '5~120분' }]}
              />
              {durationId === 'custom' && (
                <label className="mt-3 flex flex-col gap-1 text-sm">
                  <span className="text-xs font-semibold text-ink-soft">
                    집중 시간 (5~120분, 5분 단위 · 방장만 설정, 시작 후 잠김)
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    value={customMin}
                    onChange={(e) => setCustomMin(Number(e.target.value))}
                    className="h-10 w-32 rounded-xl border border-line bg-surface px-3"
                  />
                </label>
              )}
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2.5 text-sm">
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={persistent}
                  onChange={(e) => setPersistent(e.target.checked)}
                />
                상시 방으로 만들기
              </label>
              <p className="mt-1 text-xs text-ink-soft">
                전원이 완주해도 방이 닫히지 않고 대기실로 돌아와요. 같은
                코드로 다시 모여 이어서 할 수 있어요. (1인당{' '}
                {MAX_PERSISTENT_ROOMS}개까지)
              </p>
            </div>
            <Button fullWidth disabled={busy} onClick={submitCreate}>
              {busy ? '만드는 중…' : '방 만들기'}
            </Button>
          </div>
        </Card>

        <Card tone="blue">
          <CardTitle>코드로 입장</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            친구가 알려준 6자리 코드를 입력해 주세요. 이미 시작된 방에도
            자리가 남아 있으면 이어서 들어갈 수 있어요.
          </p>
          <div className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="방 코드"
                id="room-code"
                maxLength={6}
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            </div>
            <Button disabled={busy || joinCode.trim().length < 6} onClick={submitJoin}>
              입장
            </Button>
          </div>
          {errorMessage && (
            <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-sm text-[#b8285a]">
              {errorMessage}
            </p>
          )}

          {myRooms.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-ink">내 상시 방</p>
              <div className="mt-2 flex flex-col gap-2">
                {myRooms.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="tabular text-sm font-bold tracking-[0.2em] text-ink">
                        {r.code}
                      </p>
                      {r.subject && (
                        <p className="truncate text-xs text-ink-soft">{r.subject}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={async () => {
                        const result = await joinRoom(r.code)
                        if (result.ok) navigate(ROUTES.room(r.code))
                      }}
                    >
                      재입장
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
