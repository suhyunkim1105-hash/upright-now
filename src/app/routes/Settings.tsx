import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  SegmentedControl,
  TextField,
} from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { PRIVACY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useUserStore } from '@/features/onboarding/userStore'
import { useCalibrationStore } from '@/features/calibration/calibrationStore'
import { resetAllData } from '@/features/settings/dataReset'
import { sanitizeReactionText } from '@/features/rooms/roomEvents'
import { useToast } from '@/app/providers/ToastProvider'
import { SchoolPicker } from '@/components/campus/SchoolPicker'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { CAMPUS_COPY } from '@/constants/campus'
import type { Sensitivity } from '@/constants/posture'

/** 서버 membership 동기화 결과 안내 — 표시 후 자동으로 비웁니다. */
function CampusSyncNotice() {
  const notice = useCampusThemeStore((s) => s.syncNotice)
  const clear = useCampusThemeStore((s) => s.clearSyncNotice)
  if (!notice) return null
  return (
    <output
      className="mt-2 rounded-xl bg-canvas px-3 py-2 text-xs font-semibold text-ink"
    >
      {notice}
      <button type="button" className="ml-2 underline" onClick={clear}>
        닫기
      </button>
    </output>
  )
}

/** S-16 설정 — 실제 동작하는 설정 화면 */
export function Settings() {
  const navigate = useNavigate()
  const { push } = useToast()
  const nickname = useUserStore((s) => s.nickname)
  const setNickname = useUserStore((s) => s.setNickname)
  const soundEnabled = useUserStore((s) => s.soundEnabled)
  const toggleSound = useUserStore((s) => s.toggleSound)
  const pipAutoOpen = useUserStore((s) => s.pipAutoOpen)
  const customReactions = useUserStore((s) => s.customReactions)
  const setCustomReactions = useUserStore((s) => s.setCustomReactions)
  const reactionSoundEnabled = useUserStore((s) => s.reactionSoundEnabled)
  const toggleReactionSound = useUserStore((s) => s.toggleReactionSound)
  const togglePipAutoOpen = useUserStore((s) => s.togglePipAutoOpen)
  const sensitivity = useCalibrationStore((s) => s.sensitivity)
  const setSensitivity = useCalibrationStore((s) => s.setSensitivity)
  const profile = useCalibrationStore((s) => s.profile)

  const [nicknameDraft, setNicknameDraft] = useState(nickname)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cameraLabel, setCameraLabel] = useState<string | null>(null)
  const [cameraChecking, setCameraChecking] = useState(false)

  const checkCamera = async () => {
    setCameraChecking(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      const label = stream.getVideoTracks()[0]?.label || '이름 없는 카메라'
      // 확인 즉시 모든 트랙을 정지합니다. 영상은 사용·저장하지 않습니다.
      for (const track of stream.getTracks()) track.stop()
      setCameraLabel(label)
    } catch {
      setCameraLabel('카메라를 열 수 없어요. 권한과 연결을 확인해 주세요.')
    } finally {
      setCameraChecking(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="설정"
        description="감지 민감도, 소리, 카메라, 개인 자세 기준과 데이터를 관리해요."
        back={ROUTES.home}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 닉네임 */}
        <Card>
          <CardTitle>닉네임</CardTitle>
          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <TextField
                label="별명"
                id="settings-nickname"
                maxLength={12}
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                hint="최대 12자 · 이 브라우저에만 저장돼요"
              />
            </div>
            <Button
              onClick={() => {
                setNickname(nicknameDraft)
                push({ title: '닉네임을 바꿨어요.', tone: 'success' })
              }}
            >
              저장
            </Button>
          </div>
        </Card>

        {/*
          학교 선택 — 캠퍼스 테마/영토전 플래그가 켜질 때만 나타납니다.
          대학 인증이 없으므로 비공식 테마라는 사실을 카드 안에 그대로 적습니다.
        */}
        {featureFlags.campusSchoolPicker && (
          <Card className="lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>학교 선택 (캠퍼스 테마)</CardTitle>
              <Badge tone="muted">비공식</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {`${CAMPUS_COPY.unofficialGame} ${CAMPUS_COPY.privacy}`}
            </p>
            <CampusSyncNotice />
            <div className="mt-4">
              <SchoolPicker
                onChanged={() =>
                  push({ title: '캠퍼스 테마를 바꿨어요.', tone: 'success' })
                }
              />
            </div>
          </Card>
        )}

        {/* 감지 민감도 */}
        <Card>
          <CardTitle>감지 민감도</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            개인 기준에서 얼마나 벗어나면 알려줄지 정해요.
          </p>
          <div className="mt-3">
            <SegmentedControl
              ariaLabel="감지 민감도"
              columns={3}
              value={sensitivity}
              onChange={(id) => setSensitivity(id as Sensitivity)}
              options={[
                { id: 'gentle', label: '부드럽게', sublabel: '넓은 허용 범위' },
                { id: 'default', label: '기본', sublabel: '권장' },
                { id: 'sensitive', label: '민감하게', sublabel: '좁은 허용 범위' },
              ]}
            />
          </div>
        </Card>

        {/* 소리 */}
        <Card>
          <CardTitle>소리</CardTitle>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-ink-soft">회복·완료 순간의 알림음</p>
            <Button
              variant={soundEnabled ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleSound}
              aria-pressed={soundEnabled}
            >
              {soundEnabled ? '켜짐' : '꺼짐'}
            </Button>
          </div>
        </Card>

        {/* PiP 미니 위젯 */}
        <Card>
          <CardTitle>미니 위젯</CardTitle>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink">다른 탭으로 전환할 때 PiP 동행</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                집중 중 다른 탭으로 이동하면 아기 거북이 PiP가 동행해요.
                거북이를 누르면 카메라를 열 수 있고, 지원하지 않는 브라우저에서는
                원래 세션 화면에서 카메라를 계속 확인할 수 있어요.
              </p>
            </div>
            <Button
              variant={pipAutoOpen ? 'primary' : 'secondary'}
              size="sm"
              onClick={togglePipAutoOpen}
              aria-pressed={pipAutoOpen}
            >
              {pipAutoOpen ? '켜짐' : '꺼짐'}
            </Button>
          </div>
        </Card>

        {/* 카메라 */}
        <Card>
          <CardTitle>카메라</CardTitle>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft">카메라 자세 감지</span>
              <Badge tone={featureFlags.camera ? 'green' : 'muted'}>
                {featureFlags.camera ? '사용 중' : '사용 안 함'}
              </Badge>
            </div>
            {featureFlags.camera && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">현재 카메라</span>
                  <Button size="sm" variant="secondary" onClick={checkCamera} disabled={cameraChecking}>
                    {cameraChecking ? '확인 중…' : '카메라 확인'}
                  </Button>
                </div>
                {cameraLabel && (
                  <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-ink">
                    {cameraLabel}
                  </p>
                )}
              </>
            )}
            <p className="text-xs text-ink-soft">{PRIVACY.body}</p>
          </div>
        </Card>

        {/* 개인 자세 기준 */}
        <Card>
          <CardTitle>개인 자세 기준</CardTitle>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-sm text-ink-soft">
              {profile ? (
                <>
                  <Badge tone="green">등록됨</Badge>
                  <p className="mt-1 text-xs">
                    {new Date(profile.createdAt).toLocaleString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · 표본 {profile.quality.validSampleCount}개
                  </p>
                </>
              ) : (
                <Badge tone="muted">등록 전</Badge>
              )}
            </div>
            <Button size="sm" onClick={() => navigate(ROUTES.calibration)}>
              {profile ? '다시 등록' : '기준 등록'}
            </Button>
          </div>
        </Card>

        {/* 내 응원 문구 — 친구 방에서 쓸 짧은 문구 (자유 채팅 아님) */}
        <Card>
          <CardTitle>내 응원 문구</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            친구 방에서 보낼 나만의 응원이에요. 최대 3개, 문구당 2~16자.
            자유 채팅은 지원하지 않아요.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                maxLength={16}
                placeholder={`응원 문구 ${i + 1}`}
                value={customReactions[i] ?? ''}
                onChange={(e) => {
                  const next = [...customReactions]
                  next[i] = e.target.value
                  setCustomReactions(next)
                }}
                onBlur={() => {
                  const clean = customReactions
                    .map((t) => sanitizeReactionText(t ?? ''))
                    .filter((t) => t.length >= 2)
                  setCustomReactions(clean)
                }}
                className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-ink-soft">친구 반응 수신 소리</p>
            <Button
              variant={reactionSoundEnabled ? 'primary' : 'secondary'}
              size="sm"
              onClick={toggleReactionSound}
              aria-pressed={reactionSoundEnabled}
            >
              {reactionSoundEnabled ? '켜짐' : '꺼짐'}
            </Button>
          </div>
        </Card>

        {/* 모드 관리 */}
        <Card>
          <CardTitle>모드 관리</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            도서관·내 공간·팀플과 내 모드(최대 3개)를 여기에서 관리해요. 모드를
            바꿔도 XP·기록은 유지돼요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate(ROUTES.profiles)}
          >
            모드 관리 열기
          </Button>
        </Card>

        {/* 데이터 초기화 */}
        <Card className="border-coral/40">
          <CardTitle>전체 로컬 데이터 초기화</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            이 브라우저에 저장된 모든 기록을 지우고 첫 방문 상태로 돌아가요.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 border-coral text-[#b8285a]"
            onClick={() => setConfirmOpen(true)}
          >
            <Icon name="shield" size={16} />
            모든 데이터 삭제
          </Button>
        </Card>
      </div>

      {/* 삭제 확인 모달 */}
      {confirmOpen && (
        <div aria-hidden="true" className="fixed inset-0 z-40 bg-ink/40" />
      )}
      {confirmOpen && (
        <dialog
          open
          aria-modal="true"
          aria-label="데이터 삭제 확인"
          className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-transparent p-4"
        >
          <Card className="w-full max-w-md">
            <CardTitle>정말 모든 데이터를 삭제할까요?</CardTitle>
            <p className="mt-2 text-sm text-ink-soft">아래 항목이 삭제돼요.</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-ink">
              <li>· 닉네임</li>
              <li>· 개인 자세 기준</li>
              <li>· 세션 기록</li>
              <li>· XP·잎사귀 포인트</li>
              <li>· 출석</li>
              <li>· 구매·장착 아이템</li>
              <li>· 환경 모드</li>
            </ul>
            <p className="mt-3 text-xs text-ink-soft">
              카메라 영상·프레임은 애초에 저장되지 않아요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>
                취소
              </Button>
              <Button
                size="sm"
                className="bg-coral"
                onClick={() => {
                  resetAllData()
                  setConfirmOpen(false)
                  push({ title: '모든 데이터를 삭제했어요.', tone: 'info' })
                  navigate(ROUTES.home)
                }}
              >
                삭제하기
              </Button>
            </div>
          </Card>
        </dialog>
      )}
    </AppShell>
  )
}
