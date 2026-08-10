/**
 * One Euro Filter — 랜드마크 지터 억제 (Casiez, Roussel, Vogel 2012)
 *
 * 왜 필요한가: 판정 축 중 거리에 가장 민감한 `faceScaleRatio` 의 분자
 * eyeDist 는 화면 폭의 4% 정도밖에 안 됩니다. MediaPipe 의 프레임당 몇 px
 * 흔들림이 그대로 10%대 잡음이 되어, 머리가 8cm 앞으로 나온 실제 신호를
 * 덮어 버립니다. 문턱을 낮춰서 풀면 오탐이 같이 올라오므로, 문턱을 만지기
 * 전에 잡음을 먼저 줄여야 합니다.
 *
 * 단순 EMA 를 쓰지 않는 이유: 고정 EMA 는 가만히 있을 때 충분히 매끄러우면
 * 움직일 때 지연이 눈에 띄고, 반대로 맞추면 정지 시 잡음이 남습니다.
 * One Euro 는 추정 속도에 따라 차단 주파수를 올려, 정지 중에는 세게 깎고
 * 자세를 바꾸는 순간에는 거의 통과시킵니다.
 */

/** 저역 통과 한 채널 */
class LowPass {
  private y: number | null = null

  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y
    return this.y
  }

  get value(): number | null {
    return this.y
  }
}

export interface OneEuroOptions {
  /** 정지 상태 차단 주파수 (Hz). 낮을수록 매끄럽고 지연이 큽니다. */
  minCutoff?: number
  /** 속도 반응 계수. 클수록 빠른 움직임에서 지연이 줄어듭니다. */
  beta?: number
  /** 속도 추정 자체의 차단 주파수 (Hz) */
  dCutoff?: number
}

function alphaOf(cutoff: number, rate: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  const te = 1 / rate
  return 1 / (1 + tau / te)
}

/** 스칼라 한 개를 따라가는 필터 */
export class OneEuro {
  private readonly minCutoff: number
  private readonly beta: number
  private readonly dCutoff: number
  private readonly x = new LowPass()
  private readonly dx = new LowPass()
  private lastTime: number | null = null

  constructor({ minCutoff = 0.8, beta = 0.01, dCutoff = 1 }: OneEuroOptions = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  filter(value: number, timestampMs: number): number {
    const prev = this.x.value
    // 첫 프레임, 또는 탭 전환 등으로 간격이 비정상이면 기본 12fps 로 봅니다.
    const dt = this.lastTime === null ? 0 : (timestampMs - this.lastTime) / 1000
    const rate = dt > 0.001 && dt < 1 ? 1 / dt : 12
    this.lastTime = timestampMs

    const speed = prev === null ? 0 : (value - prev) * rate
    const speedHat = this.dx.filter(speed, alphaOf(this.dCutoff, rate))
    const cutoff = this.minCutoff + this.beta * Math.abs(speedHat)
    return this.x.filter(value, alphaOf(cutoff, rate))
  }
}

export interface SmoothableLandmark {
  x: number
  y: number
  z: number
  visibility?: number
}

/**
 * 랜드마크 배열 전체를 채널별로 따라가는 필터.
 *
 * visibility 는 건드리지 않습니다 — "보이는 정도"라서 매끄럽게 만들면
 * 사람이 프레임을 벗어난 순간을 늦게 알아차립니다.
 */
export class LandmarkSmoother {
  private readonly filters = new Map<string, OneEuro>()
  private readonly options: OneEuroOptions

  constructor(options: OneEuroOptions = {}) {
    this.options = options
  }

  reset(): void {
    this.filters.clear()
  }

  private channel(key: string): OneEuro {
    let f = this.filters.get(key)
    if (!f) {
      f = new OneEuro(this.options)
      this.filters.set(key, f)
    }
    return f
  }

  smooth<T extends SmoothableLandmark>(
    landmarks: T[] | undefined,
    timestampMs: number,
  ): T[] | undefined {
    if (!landmarks) return landmarks
    return landmarks.map((lm, i) => ({
      ...lm,
      x: this.channel(`${i}x`).filter(lm.x, timestampMs),
      y: this.channel(`${i}y`).filter(lm.y, timestampMs),
      z: this.channel(`${i}z`).filter(lm.z, timestampMs),
    }))
  }
}
