import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CAMERA_DEMO_NOTICE, PRIVACY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { useDemoStore } from '@/features/demo/demoMode'

const STEPS = [
  {
    title: '권한 확인',
    body: '직접 버튼을 누른 뒤에만 브라우저 권한창이 열려요.',
    icon: 'shield',
  },
  {
    title: '5초 기준 맞추기',
    body: '얼굴과 어깨가 보이게 편안히 앉아 주세요.',
    icon: 'camera',
  },
  {
    title: '기기 안에서 분석',
    body: '영상은 저장하지도, 외부로 보내지도 않아요.',
    icon: 'check',
  },
]

/** S-04 카메라 안내 — 권한은 사용자가 CTA를 누른 뒤에만 요청합니다. */
export function CameraIntro() {
  const navigate = useNavigate()
  const configure = useSessionStore((s) => s.configure)

  const startDemo = () => {
    useDemoStore.getState().enableDemo()
    configure({ lengthId: 'demo' })
    navigate(ROUTES.sessionSetup)
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="자세를 살펴볼 수 있게 카메라를 연결해 주세요"
        description="카메라는 처음 등록한 기준과의 변화만 이 기기 안에서 살펴봐요."
        back={ROUTES.profiles}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card tone="green" className="relative overflow-hidden p-6 sm:p-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 -top-10 text-[132px] font-black leading-none text-green/10"
          >
            3
          </span>
          <div className="relative">
            <div className="flex items-center gap-2 text-sm font-bold text-green">
              <span className="grid size-8 place-items-center rounded-xl bg-surface text-green shadow-card">
                <Icon name="camera" size={17} />
              </span>
              시작 전 1분 준비
            </div>
            <h2 className="mt-5 max-w-xl text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              편안한 자리에 앉은 뒤, 직접 연결해 주세요.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink">
              권한은 아래 버튼을 누를 때만 요청해요. 연결 뒤에는 내 기준을 5초 동안 맞추고,
              세션에서 그 기준과 달라진 정도만 알려드려요.
            </p>

            <ol className="mt-7 grid gap-2 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="min-h-[124px] rounded-2xl border border-green/15 bg-surface/85 p-4"
                >
                  <span className="flex items-center justify-between text-xs font-bold text-green">
                    <span>{`0${index + 1}`}</span>
                    <Icon name={step.icon} size={17} />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-ink-soft">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-7">
              {featureFlags.camera ? (
                <Button
                  size="lg"
                  className="bg-[#b8285a] hover:bg-[#9f204b]"
                  onClick={() => navigate(ROUTES.calibration)}
                >
                  <Icon name="camera" size={18} />
                  카메라 연결하기
                </Button>
              ) : (
                // 카메라 기능이 꺼져 있으면 데모가 주 CTA 입니다.
                <Button size="lg" className="bg-[#b8285a] hover:bg-[#9f204b]" onClick={startDemo}>
                  <Icon name="play" size={18} />
                  카메라 없이 3분 데모
                </Button>
              )}
            </div>
          </div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card className="border-green/25 p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-green-soft text-green">
                <Icon name="shield" size={17} />
              </span>
              <div>
                <h2 className="text-base font-bold text-ink">카메라 정보는 여기만</h2>
                <p className="text-xs text-ink-soft">연결 전에 꼭 확인해 주세요</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRIVACY.badges.map((badge) => (
                <Badge key={badge} tone="green">
                  <Icon name="shield" size={14} />
                  {badge}
                </Badge>
              ))}
            </div>
            <p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-ink-soft">
              {PRIVACY.medical}
            </p>
          </Card>

          {featureFlags.camera ? (
            <Card tone="canvas" className="p-5">
              <p className="text-sm font-bold text-ink">먼저 흐름만 살펴보고 싶다면</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                카메라 없이도 3분 동안 상태 변화와 회복 흐름을 체험할 수 있어요.
              </p>
              <Button size="sm" variant="secondary" className="mt-4" onClick={startDemo}>
                <Icon name="play" size={16} />
                카메라 없이 3분 데모
              </Button>
            </Card>
          ) : (
            <Card tone="yellow" className="p-5">
              <p className="flex items-start gap-2 text-sm font-bold leading-6 text-ink">
                <Icon name="play" size={16} className="mt-0.5 shrink-0" />
                {CAMERA_DEMO_NOTICE}
              </p>
            </Card>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
