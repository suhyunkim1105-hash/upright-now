export type CameraFrameQuality =
  | 'pending'
  | 'good'
  | 'dim'
  | 'low-contrast'
  | 'motion'

export interface FrameQualityReading {
  quality: CameraFrameQuality
  luminance: number
  contrast: number
  motion: number
}

const MIN_LUMINANCE = 42
const MIN_CONTRAST = 9
const MAX_MOTION = 28

export function sampleLuminance(pixels: Uint8ClampedArray): Float32Array {
  const luminance = new Float32Array(pixels.length / 4)

  for (let index = 0; index < luminance.length; index += 1) {
    const offset = index * 4
    luminance[index] =
      0.2126 * pixels[offset] +
      0.7152 * pixels[offset + 1] +
      0.0722 * pixels[offset + 2]
  }

  return luminance
}

export function evaluateFrameQuality(
  luminance: Float32Array,
  previous: Float32Array | null,
): FrameQualityReading {
  if (luminance.length === 0) {
    return { quality: 'pending', luminance: 0, contrast: 0, motion: 0 }
  }

  const average =
    luminance.reduce((total, value) => total + value, 0) / luminance.length
  const variance =
    luminance.reduce((total, value) => total + (value - average) ** 2, 0) /
    luminance.length
  const motion =
    previous && previous.length === luminance.length
      ? luminance.reduce((total, value, index) => total + Math.abs(value - previous[index]), 0) /
        luminance.length
      : 0

  if (average < MIN_LUMINANCE) {
    return { quality: 'dim', luminance: average, contrast: Math.sqrt(variance), motion }
  }
  if (Math.sqrt(variance) < MIN_CONTRAST) {
    return {
      quality: 'low-contrast',
      luminance: average,
      contrast: Math.sqrt(variance),
      motion,
    }
  }
  if (previous && motion > MAX_MOTION) {
    return { quality: 'motion', luminance: average, contrast: Math.sqrt(variance), motion }
  }

  return { quality: 'good', luminance: average, contrast: Math.sqrt(variance), motion }
}
