import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { ROUTES } from '@/constants/routes'
import { PRIVACY } from '@/constants/copy'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useCamera } from '@/features/calibration/useCamera'
import { useFrameQuality } from '@/features/calibration/useFrameQuality'
import { usePoseDetection, type PoseFrame } from '@/features/posture-engine/usePoseDetection'
import type { MoveNetBenchmarkResult } from '@/features/posture-engine/tfjsMoveNetBenchmark'
import {
  collectStep,
  createCollectState,
  MIN_VALID_SAMPLES,
  type CalibrationQuality,
} from '@/features/calibration/collect'
import {
  hashDeviceId,
  useCalibrationStore,
} from '@/features/calibration/calibrationStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useModeStore } from '@/features/modes/modeStore'
import { lineRollDeg, MAX_EYE_ROLL_DEG } from '@/features/calibration/framingGate'
import type { LandmarkAnalysis, PointName } from '@/features/posture-engine/features'

const QUALITY_COPY: Record<CalibrationQuality, string> = {
  idle: '카메라를 준비하고 있어요.',
  framing: '얼굴과 양쪽 어깨를 확인하고 있어요. 잠깐 그대로 있어 주세요.',
  ok: '좋아요. 그대로 잠깐 유지해 주세요.',
  'no-person': '화면 중앙에 앉아 얼굴이 보이도록 해 주세요.',
  'low-visibility': '얼굴과 양쪽 어깨가 보이게 앉고 주변을 조금 밝혀 주세요.',
  moving: '잠깐 편안한 자세를 유지해 주세요.',
  dim: '주변을 조금 밝혀 주세요. 프레임 품질을 확인한 뒤 기준을 등록할게요.',
  'low-contrast': '얼굴과 어깨가 배경과 구분되도록 주변을 조금 밝혀 주세요.',
  'camera-motion': '카메라가 흔들리지 않도록 잠깐 고정해 주세요.',
  rotated: '화면 정면을 바라봐 주세요.',
  tilted: '선에 정확히 맞출 필요는 없어요. 얼굴과 양쪽 어깨가 모두 보이도록 편안하게 앉아 주세요.',
  timeout: '표본을 충분히 모으지 못했어요. 자세를 잡고 다시 시작할게요.',
}

const CAMERA_ERROR_COPY: Record<string, string> = {
  'permission-denied':
    '카메라 권한이 필요해요. 브라우저 주소창의 권한을 허용하고 다시 시도해 주세요.',
  'no-device': '연결된 카메라를 찾지 못했어요. 카메라를 연결하고 다시 시도해 주세요.',
  'in-use': '다른 앱이 카메라를 사용 중일 수 있어요. 해당 앱을 닫고 다시 시도해 주세요.',
  unknown: '카메라를 여는 중 문제가 생겼어요. 다시 시도해 주세요.',
}

/** ?postureDebug=1 일 때만 표시하는 랜드마크 오버레이 */
/**
 * 동적 프레이밍 가이드 — 고정 위치에 맞추라는 뜻이 아니라,
 * "실제 감지된" 눈선·어깨선을 그대로 보여줍니다.
 * 허용 범위(roll ≤ ROLL_LIMIT_DEG)는 초록, 과도한 기울임은 코랄.
 * 판정은 픽셀 위치가 아니라 shoulder width ratio·face scale·safe area 기반입니다.
 */
function DynamicFramingGuide({ analysis }: { analysis: LandmarkAnalysis | null }) {
  const seg = (a: PointName, b: PointName) => {
    if (!analysis) return null
    const p = analysis.points[a]
    const q = analysis.points[b]
    if (!p.present || !q.present) return null
    const roll = Math.abs(lineRollDeg(p, q))
    const ok = roll <= MAX_EYE_ROLL_DEG
    return (
      <line
        x1={p.x * 100}
        y1={p.y * 100}
        x2={q.x * 100}
        y2={q.y * 100}
        stroke={ok ? '#4ade80' : '#ff6464'}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    )
  }
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* 넓은 상체 safe frame — 이 안에 얼굴·어깨가 들어오면 충분합니다 */}
      <div className="absolute inset-x-[12%] inset-y-[8%] rounded-[2rem] border-2 border-dashed border-white/50" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full -scale-x-100"
      >
        {seg('leftEyeOuter', 'rightEyeOuter')}
        {seg('leftShoulder', 'rightShoulder')}
      </svg>
    </div>
  )
}

function LandmarkOverlay({ analysis }: { analysis: LandmarkAnalysis | null }) {
  if (!analysis) return null
  const line = (a: PointName, b: PointName) => {
    const p = analysis.points[a]
    const q = analysis.points[b]
    if (!p.present || !q.present) return null
    return (
      <line
        key={`${a}-${b}`}
        x1={p.x * 100}
        y1={p.y * 100}
        x2={q.x * 100}
        y2={q.y * 100}
        stroke="#5F8FF7"
        strokeWidth={0.7}
      />
    )
  }
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
      aria-hidden="true"
    >
      {line('leftEyeOuter', 'rightEyeOuter')}
      {line('leftShoulder', 'rightShoulder')}
      {line('leftHip', 'rightHip')}
      {(Object.keys(analysis.points) as PointName[]).map((name) => {
        const p = analysis.points[name]
        if (!p.present) return null
        const core =
          name === 'nose' ||
          name.includes('EyeOuter') ||
          name.includes('Shoulder')
        return (
          <circle
            key={name}
            cx={p.x * 100}
            cy={p.y * 100}
            r={core ? 1.3 : 0.9}
            fill={core ? '#F45B8D' : '#F2C94C'}
          />
        )
      })}
    </svg>
  )
}

/** S-05 캘리브레이션 — 5초 개인 기준 등록 (워밍업 1초 + 유효 40프레임) */
export function Calibration() {
  const navigate = useNavigate()
  const location = useLocation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const collectRef = useRef(createCollectState())
  const { state: camera, start, stop } = useCamera(videoRef)
  const addProfile = useCalibrationStore((s) => s.addProfile)
  const setCalibrated = useUserStore((s) => s.setCalibrated)

  const debugOverlay = new URLSearchParams(location.search).get('postureDebug') === '1'

  const [quality, setQuality] = useState<CalibrationQuality>('idle')
  const [progress, setProgress] = useState(0)
  const [validCount, setValidCount] = useState(0)
  const [saved, setSaved] = useState(false)
  const [uiStep, setUiStep] = useState<1 | 2 | 3>(1)
  const [profileName, setProfileName] = useState('')
  const savedIdRef = useRef<string | null>(null)
  // 내부 경로만 허용 — 외부 URL·프로토콜 상대 경로는 무시합니다.
  const rawReturn = new URLSearchParams(location.search).get('return')
  const returnTo =
    rawReturn && rawReturn.startsWith('/') && !rawReturn.startsWith('//')
      ? rawReturn
      : null
  const [modelError, setModelError] = useState(false)
  const [lastAnalysis, setLastAnalysis] = useState<LandmarkAnalysis | null>(null)
  const [benchmark, setBenchmark] = useState<MoveNetBenchmarkResult | null>(null)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false)
  const frameQuality = useFrameQuality(
    videoRef,
    featureFlags.camera && camera.status === 'ready' && !saved,
  )

  useEffect(() => {
    if (!featureFlags.camera) return
    start()
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { modelStatus } = usePoseDetection(videoRef, {
    enabled: featureFlags.camera && camera.status === 'ready' && !saved,
    onFrame: (frame: PoseFrame) => {
      setLastAnalysis(frame.analysis)

      const step = collectStep(collectRef.current, {
        analysis: frame.multiPerson ? null : frame.analysis,
        now: performance.now(),
        deviceIdHash: hashDeviceId(camera.deviceId),
        frameQuality:
          frameQuality.quality === 'pending' ? undefined : frameQuality.quality,
      })
      collectRef.current = step.state
      setQuality(step.quality)
      setProgress(step.progress)
      setValidCount(step.validCount)
      setUiStep(step.step)

      if (step.profile) {
        // 개인 기준 요약(중앙값·MAD·표본 수)만 저장합니다. 원본은 저장하지 않습니다.
        const named = {
          ...step.profile,
          name: '기준 ' + (useCalibrationStore.getState().profiles.length + 1),
        }
        addProfile(named)
        savedIdRef.current = named.id
        setProfileName(named.name)
        // 현재 활성 모드에 이 기준을 연결합니다.
        useModeStore.getState().linkCalibration(useModeStore.getState().activeModeId, named.id)
        setCalibrated(true)
        setSaved(true)
      }
    },
  })

  useEffect(() => {
    if (modelStatus === 'error') setModelError(true)
  }, [modelStatus])

  const runMoveNetBenchmark = async () => {
    const video = videoRef.current
    if (!video || camera.status !== 'ready') return

    setBenchmarkLoading(true)
    try {
      const { benchmarkMoveNet } = await import(
        '@/features/posture-engine/tfjsMoveNetBenchmark'
      )
      setBenchmark(await benchmarkMoveNet(video))
    } catch {
      setBenchmark({ status: 'error', message: 'MoveNet/WASM 진단을 준비하지 못했어요.' })
    } finally {
      setBenchmarkLoading(false)
    }
  }

  if (!featureFlags.camera) {
    return (
      <AppShell chrome="focus">
        <PageHeader
          title="자세 기준 등록"
          description="얼굴과 양쪽 어깨가 보이도록 편안하게 앉은 자세를 5초 동안 등록해요."
          back={ROUTES.camera}
        />
        <Card tone="yellow">
          <p className="text-sm font-bold text-ink">
            지금은 카메라 없이 데모로 흐름을 확인할 수 있어요.
          </p>
          <Button className="mt-4" onClick={() => navigate(ROUTES.sessionSetup)}>
            3분 데모로 이동
          </Button>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        title="얼굴과 양쪽 어깨가 보이도록 편안하게 앉아 주세요"
        description="이 환경의 편안한 자세를 5초 동안 기준으로 등록해요. 영상은 저장하지 않아요."
        back={ROUTES.camera}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          {camera.status === 'error' && camera.error ? (
            <div>
              <Badge tone="coral">카메라 오류</Badge>
              <p className="mt-3 text-sm text-ink">
                {CAMERA_ERROR_COPY[camera.error]}
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => start(camera.deviceId ?? undefined)}>
                  다시 시도
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.sessionSetup)}
                >
                  카메라 없이 데모
                </Button>
              </div>
            </div>
          ) : modelError ? (
            <div>
              <Badge tone="coral">감지 도구 오류</Badge>
              <p className="mt-3 text-sm text-ink">
                자세 감지 도구를 준비하지 못했어요. 다시 시도하거나 데모로 확인할
                수 있어요.
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => window.location.reload()}>
                  다시 시도
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.sessionSetup)}
                >
                  카메라 없이 데모
                </Button>
              </div>
            </div>
          ) : saved ? (
            <div>
              <Badge tone="green">등록 완료</Badge>
              <p className="mt-3 text-base font-bold text-ink">
                이 환경의 자세 기준을 저장했어요.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                이제 이 기준과 비교해 자세 변화를 알려드려요.
              </p>
              <div className="mt-3">
                <label htmlFor="cal-name" className="text-xs font-semibold text-ink-soft">
                  기준 이름 (예: 집 책상 · 학교 도서관)
                </label>
                <input
                  id="cal-name"
                  maxLength={20}
                  value={profileName}
                  onChange={(e) => {
                    setProfileName(e.target.value)
                    if (savedIdRef.current)
                      useCalibrationStore.getState().renameProfile(savedIdRef.current, e.target.value)
                  }}
                  className="mt-1 block h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink"
                />
              </div>
              <Button
                className="mt-4"
                onClick={() => {
                  stop()
                  navigate(returnTo ?? ROUTES.sessionSetup)
                }}
              >
                {returnTo ? '이전 화면으로 돌아가기' : '집중 세션 설정으로'}
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-ink">
                {modelStatus === 'loading'
                  ? '자세 감지 도구를 불러오는 중이에요…'
                  : QUALITY_COPY[quality]}
              </p>
              <div className="mt-3">
                <Progress value={progress} tone="pink" label="캘리브레이션 진행" />
              </div>
              <p className="mt-2 text-xs text-ink-soft tabular">
                {`유효 표본 ${validCount} / ${MIN_VALID_SAMPLES}`}
              </p>
              {frameQuality.quality !== 'pending' && (
                <p className="mt-1 text-xs text-ink-soft">
                  {`카메라 환경: ${
                    frameQuality.quality === 'good'
                      ? '캘리브레이션에 쓸 수 있는 프레임이에요.'
                      : QUALITY_COPY[
                          frameQuality.quality === 'motion'
                            ? 'camera-motion'
                            : frameQuality.quality
                        ]}`}
                </p>
              )}
              <ol className="mt-4 flex flex-col gap-1.5 text-xs">
                {['얼굴과 양쪽 어깨 확인', '편안한 자세로 5초 유지', '기준 저장 완료'].map((label, i) => (
                  <li key={label} className={'flex items-center gap-2 ' + (uiStep === i + 1 ? 'font-bold text-ink' : 'text-ink-soft')}>
                    <Icon name={uiStep > i + 1 ? 'check' : 'clock'} size={14} /> {i + 1}. {label}
                  </li>
                ))}
              </ol>
              {debugOverlay && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="text-xs font-bold text-ink">개발용 보조 엔진 진단</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    MoveNet/WASM을 10프레임만 측정해 MediaPipe와의 성능 비교 근거로 씁니다.
                    이 결과와 프레임은 저장하거나 전송하지 않아요.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    disabled={benchmarkLoading || camera.status !== 'ready'}
                    onClick={() => void runMoveNetBenchmark()}
                  >
                    {benchmarkLoading ? 'MoveNet/WASM 측정 중…' : 'MoveNet/WASM 10프레임 측정'}
                  </Button>
                  {benchmark && (
                    <p className="mt-2 text-xs text-ink-soft" aria-live="polite">
                      {benchmark.status === 'ready'
                        ? `WASM · 로드 ${benchmark.loadMs}ms · 중앙 추론 ${benchmark.medianInferenceMs}ms · 약 ${benchmark.estimatedFps}fps · 감지 ${benchmark.detectedFrames}/${benchmark.sampleCount}`
                        : benchmark.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card tone="canvas">
          <div className="relative overflow-hidden rounded-2xl bg-ink/5">
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-[4/3] w-full -scale-x-100 object-cover"
            />
            {debugOverlay ? (
              <LandmarkOverlay analysis={lastAnalysis} />
            ) : (
              <DynamicFramingGuide analysis={lastAnalysis} />
            )}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft">
            <Icon name="shield" size={14} />
            {PRIVACY.body}
          </p>
        </Card>
      </div>
    </AppShell>
  )
}
