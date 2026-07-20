/**
 * Camera pose vocabulary and prompt grammar, ported verbatim from
 * jtydhr88/ComfyUI-qwenmultiangle (MIT) — CameraWidget.ts / nodes.py.
 */

export const AZIMUTH_LABELS = [
  'front view',
  'front-right quarter view',
  'right side view',
  'back-right quarter view',
  'back view',
  'back-left quarter view',
  'left side view',
  'front-left quarter view'
] as const

export const ELEVATION_LABELS = [
  'low-angle shot',
  'eye-level shot',
  'elevated shot',
  'high-angle shot'
] as const

export const DISTANCE_LABELS = ['wide shot', 'medium shot', 'close-up'] as const

export type AzimuthLabel = (typeof AZIMUTH_LABELS)[number]
export type ElevationLabel = (typeof ELEVATION_LABELS)[number]
export type DistanceLabel = (typeof DISTANCE_LABELS)[number]

export interface CameraPose {
  azimuth: number
  elevation: number
  zoom: number
}

export const DEFAULT_POSE: CameraPose = { azimuth: 0, elevation: 0, zoom: 5 }

export const AZIMUTH_PRESETS: ReadonlyArray<{
  label: AzimuthLabel
  value: number
}> = AZIMUTH_LABELS.map((label, i) => ({ label, value: i * 45 }))

export const ELEVATION_PRESETS: ReadonlyArray<{
  label: ElevationLabel
  value: number
}> = [
  { label: 'low-angle shot', value: -30 },
  { label: 'eye-level shot', value: 0 },
  { label: 'elevated shot', value: 30 },
  { label: 'high-angle shot', value: 60 }
]

export const DISTANCE_PRESETS: ReadonlyArray<{
  label: DistanceLabel
  value: number
}> = [
  { label: 'wide shot', value: 1 },
  { label: 'medium shot', value: 4 },
  { label: 'close-up', value: 8 }
]

export function azimuthLabel(degrees: number): AzimuthLabel {
  const h = ((degrees % 360) + 360) % 360
  if (h < 22.5 || h >= 337.5) return 'front view'
  return AZIMUTH_LABELS[Math.floor((h - 22.5) / 45) + 1]
}

export function elevationLabel(degrees: number): ElevationLabel {
  if (degrees < -15) return 'low-angle shot'
  if (degrees < 15) return 'eye-level shot'
  if (degrees < 45) return 'elevated shot'
  return 'high-angle shot'
}

export function distanceLabel(zoom: number): DistanceLabel {
  if (zoom < 2) return 'wide shot'
  if (zoom < 6) return 'medium shot'
  return 'close-up'
}

export function promptString(pose: CameraPose): string {
  return `<sks> ${azimuthLabel(pose.azimuth)} ${elevationLabel(pose.elevation)} ${distanceLabel(pose.zoom)}`
}

export function clampAzimuth(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360
}

export function clampElevation(value: number): number {
  return Math.min(60, Math.max(-30, Math.round(value)))
}

export function clampZoom(value: number): number {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10))
}
