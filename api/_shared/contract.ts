import { z } from 'zod'
import type { AiSessionReport, SessionSummary } from './types.js'

export const AI_REPORT_SCHEMA_VERSION = '2026-07-30'

export const AI_REPORT_INPUT_FIELDS = [
  'plannedMinutes',
  'elapsedMinutes',
  'detectableMinutes',
  'awayMinutes',
  'recoveryOpportunities',
  'recoveries',
  'bestCombo',
  'status',
  // ---- 아래는 판정 엔진 집계 (docs/23_AI_REPORT_SPEC.md §2) ----
  // 전부 세션 하나에 대한 **스칼라**입니다. 좌표도 시계열도 프레임도 아니라
  // 이미 나가고 있는 recoveries 와 같은 성격이고, 개인정보 경계를 넘지 않습니다.
  'topAxis',
  'topAxisShare',
  'secondAxis',
  'holdLongestMin',
  'stateChanges',
  'phaseGood',
  'recoveryMedianSec',
  'calibratedMinutesAgo',
  'sensitivity',
] as const

/**
 * 판정 축 — 코드 상수이지 신체 치수가 아닙니다.
 * 모델에는 이 이름 대신 사람 말(AXIS_LABEL)로 넘깁니다.
 */
export const AXIS_KEYS = [
  'faceScaleRatio',
  'headHeightRatio',
  'facePitchRatio',
  'earEyeRatio',
  'shoulderSpan',
  'lateralOffsetRatio',
  'shoulderTiltRatio',
  'torsoLean',
  'headDistanceCm',
  'headPitchDeg',
] as const

/**
 * 세션 화면의 판정 배지와 **같은 표현**을 씁니다.
 * 세션에서 "화면에 가까워졌어요" 를 본 사람이 리포트에서 headDistanceCm 을
 * 보면 두 화면이 서로 다른 제품이 됩니다.
 */
export const AXIS_LABEL: Record<string, string> = {
  headDistanceCm: '화면과의 거리',
  faceScaleRatio: '화면과의 거리',
  headPitchDeg: '고개 각도',
  facePitchRatio: '고개 각도',
  earEyeRatio: '고개 각도',
  headHeightRatio: '목의 높이',
  shoulderTiltRatio: '어깨 높이',
  shoulderSpan: '몸 전체가 앞으로',
  lateralOffsetRatio: '좌우 쏠림',
  torsoLean: '좌우 쏠림',
}

export const AiReportInputSchema = z
  .object({
    plannedMinutes: z.number().int().min(1).max(300),
    elapsedMinutes: z.number().int().min(0).max(360),
    detectableMinutes: z.number().int().min(0).max(360),
    awayMinutes: z.number().int().min(0).max(360),
    recoveryOpportunities: z.number().int().min(0).max(1_000),
    recoveries: z.number().int().min(0).max(1_000),
    bestCombo: z.number().int().min(0).max(1_000),
    status: z.enum(['completed', 'aborted']),

    // 엔진 집계는 전부 선택입니다 — 기준을 안 맞춘 세션에는 축이 아예 없습니다.
    topAxis: z.enum(AXIS_KEYS).optional(),
    topAxisShare: z.number().min(0).max(1).optional(),
    secondAxis: z.enum(AXIS_KEYS).optional(),
    /** 상태가 한 번도 안 바뀐 최장 구간. OSHA 가 말하는 "정지" 그 자체 */
    holdLongestMin: z.number().int().min(0).max(360).optional(),
    stateChanges: z.number().int().min(0).max(2_000).optional(),
    /** 세션을 3등분한 구간별 good 비율. "후반에 무너진다" 를 말할 수 있는 유일한 값 */
    phaseGood: z.array(z.number().min(0).max(1)).length(3).optional(),
    recoveryMedianSec: z.number().int().min(0).max(600).optional(),
    calibratedMinutesAgo: z.number().int().min(0).max(525_600).optional(),
    sensitivity: z.enum(['gentle', 'default', 'sensitive']).optional(),
  })
  .strict()

export type AiReportInput = z.infer<typeof AiReportInputSchema>

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

const reportText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlCharacter(value), '제어 문자는 허용하지 않습니다.')

export const AiSessionReportSchema = z
  .object({
    headline: reportText(48),

    /* 오늘의 숫자 3칸. 화면이 만들 수도 있지만 AI 가 순서를 정하게 두면
       세션마다 가장 중요한 숫자가 앞에 옵니다. */
    stats: z
      .array(
        z
          .object({
            label: reportText(12),
            value: reportText(16),
          })
          .strict(),
      )
      .length(3),

    /* 무엇이 흔들렸나.
       **min 이 없는 것이 이 스키마에서 가장 중요한 한 줄입니다.**
       예전 highlights 는 length(3) 이 강제라, 할 말이 둘뿐인 세션에서
       모델이 세 번째를 지어냈습니다. 없으면 비웁니다. */
    observations: z
      .array(
        z
          .object({
            /** 숫자에서 나온 사실 */
            fact: reportText(60),
            /** 모델의 해석. 사실과 섞지 않아야 어디까지가 측정인지 압니다. */
            read: reportText(90),
          })
          .strict(),
      )
      .max(2),

    nextAction: z
      .object({
        title: reportText(24),
        instruction: reportText(80),
        /** 어느 관찰에서 나왔는지 */
        because: reportText(60),
        durationMinutes: z.number().int().min(1).max(5),
      })
      .strict(),

    /** 리포트 아래 채팅으로 이어지는 질문 칩 */
    followUps: z.array(reportText(28)).max(3),
  })
  .strict() as z.ZodType<AiSessionReport>

const UNSAFE_REPORT_TERMS = /진단|치료|처방|질환|통증|거북목|정상\s*자세|자세\s*교정/

export function isSafeAiSessionReport(report: AiSessionReport): boolean {
  return !UNSAFE_REPORT_TERMS.test(JSON.stringify(report))
}

function toMinutes(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds / 60_000))
}

/**
 * 외부 AI에 보낼 수 있는 세션 집계값의 유일한 생성 경로입니다.
 * 카메라 원본·스냅샷·좌표·자세 상태·목표 문구·식별자는 포함하지 않습니다.
 */
/** 판정 엔진이 세션 동안 모은 집계 — 전부 스칼라이고 좌표가 아닙니다. */
export type PostureAggregate = Partial<
  Pick<
    AiReportInput,
    | 'topAxis'
    | 'topAxisShare'
    | 'secondAxis'
    | 'holdLongestMin'
    | 'stateChanges'
    | 'phaseGood'
    | 'recoveryMedianSec'
    | 'calibratedMinutesAgo'
    | 'sensitivity'
  >
>

/**
 * 세션 요약 → 리포트 입력.
 *
 * **허용 목록 방식입니다.** summary 를 통째로 넘기지 않고 필요한 값만
 * 하나씩 옮깁니다 — subject·goal·sessionId 처럼 사람을 가리킬 수 있는
 * 값이 실수로 따라가지 않게 하는 유일한 방법입니다.
 */
export function createAiReportInput(
  summary: SessionSummary,
  posture: PostureAggregate = {},
): AiReportInput {
  return AiReportInputSchema.parse({
    plannedMinutes: Math.max(1, toMinutes(summary.plannedDurationMs)),
    elapsedMinutes: toMinutes(summary.elapsedMs),
    detectableMinutes: toMinutes(summary.detectableMs),
    awayMinutes: toMinutes(summary.awayMs),
    recoveryOpportunities: summary.recoveryOpportunities,
    recoveries: summary.recoveries,
    bestCombo: summary.bestCombo,
    status: summary.status,
    // 값이 없는 항목은 키 자체가 안 들어갑니다 — 모델이 undefined 를
    // "측정하지 못한 것" 으로 읽어야 합니다.
    ...posture,
  })
}
