/**
 * Darkroom's friendly names on top of the Router fields. The request still
 * sends the Router values; labels and hints live in the locale catalogs under
 * `darkroom.*`, keyed by the `key` each entry carries.
 */

export interface DarkroomModel {
  readonly id: string
  /** A product name, so it is not translated. */
  readonly name: string
  /** Key of the one-line note under `darkroom.models`. */
  readonly key: string
  /** The model has one resolution, so the request leaves `imageSize` out. */
  readonly noSize?: boolean
}

export const DARKROOM_MODELS: readonly DarkroomModel[] = [
  {
    id: 'vertexai/gemini-nano-banana-2.1',
    name: 'Nano Banana 2.1',
    key: 'nanoBanana21'
  },
  {
    id: 'vertexai/gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    key: 'nanoBanana2'
  },
  {
    id: 'vertexai/gemini-3-pro-image',
    name: 'Nano Banana Pro',
    key: 'nanoBananaPro'
  },
  {
    id: 'vertexai/gemini-3.1-flash-lite-image',
    name: 'Nano Banana 2 Lite',
    key: 'nanoBanana2Lite'
  },
  {
    id: 'vertexai/gemini-2.5-flash-image',
    name: 'Nano Banana',
    key: 'nanoBanana',
    noSize: true
  }
]

export const DEFAULT_DARKROOM_MODEL = DARKROOM_MODELS[0].id

export function darkroomModel(id: string): DarkroomModel | undefined {
  return DARKROOM_MODELS.find((model) => model.id === id)
}

export function darkroomModelName(id: string): string {
  return darkroomModel(id)?.name ?? id
}

/** `auto` leaves `aspectRatio` unset, so the model follows the references. */
export const DARKROOM_SHAPES = [
  { value: 'auto', key: 'auto' },
  { value: '1:1', key: 'square' },
  { value: '16:9', key: 'wide' },
  { value: '9:16', key: 'tall' },
  { value: '4:3', key: 'landscape' },
  { value: '3:4', key: 'portrait' },
  { value: '3:2', key: 'photo' },
  { value: '2:3', key: 'poster' },
  { value: '4:5', key: 'social' },
  { value: '21:9', key: 'cinema' }
] as const

export type DarkroomShape = (typeof DARKROOM_SHAPES)[number]['value']

export function isDarkroomShape(value: unknown): value is DarkroomShape {
  return DARKROOM_SHAPES.some((shape) => shape.value === value)
}

/** Width over height. `auto` reserves a square until the image loads. */
export function shapeRatio(shape: string | undefined): number {
  if (!shape || shape === 'auto') return 1
  const [width, height] = shape.split(':').map(Number)
  return width > 0 && height > 0 ? width / height : 1
}

/** Rows of images narrower than this sit four across. */
export const TALL_RATIO = 0.7

export const DARKROOM_SIZES = ['1K', '2K', '4K'] as const
export type DarkroomSize = (typeof DARKROOM_SIZES)[number]

/**
 * `LOW` is deliberately not offered: Router rejects it for Nano Banana 2.1.
 * The empty value leaves `thinkingConfig` unset.
 */
export const DARKROOM_PLANNING = [
  { value: '', key: 'auto' },
  { value: 'MINIMAL', key: 'quick' },
  { value: 'MEDIUM', key: 'balanced' },
  { value: 'HIGH', key: 'careful' }
] as const

export type DarkroomPlanning = (typeof DARKROOM_PLANNING)[number]['value']

export function planningKey(value: string | undefined): string {
  return (
    DARKROOM_PLANNING.find((level) => level.value === (value ?? ''))?.key ??
    'auto'
  )
}

export const DARKROOM_FORMATS = [
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' }
] as const

export type DarkroomFormat = (typeof DARKROOM_FORMATS)[number]['value']

/** Key under `darkroom.creativity` for a temperature between 0 and 2. */
export function creativityKey(temperature: number): string {
  if (temperature < 0.45) return 'steady'
  if (temperature < 0.9) return 'focused'
  if (temperature <= 1.1) return 'balanced'
  if (temperature <= 1.5) return 'loose'
  return 'wild'
}

export const DARKROOM_EXAMPLES = [
  'photo',
  'product',
  'illustration',
  'poster'
] as const

/** The most images one prompt makes. An account's concurrency can lower it. */
export const MAX_RUNS = 4

export interface DarkroomSettings {
  model: string
  runs: number
  shape: DarkroomShape
  size: DarkroomSize
  format: DarkroomFormat
  /** Empty means a fresh seed for every prompt. */
  seed: string
  planning: DarkroomPlanning
  temperature: number
  styleNotes: string
}

export const DEFAULT_DARKROOM_SETTINGS: Readonly<DarkroomSettings> = {
  model: DEFAULT_DARKROOM_MODEL,
  runs: 4,
  shape: '16:9',
  size: '2K',
  format: 'image/png',
  seed: '',
  planning: '',
  temperature: 1,
  styleNotes: ''
}

/**
 * How many images one prompt may make for an account. Router reports the
 * calls an account may have in flight: -1 is unlimited, 0 is blocked.
 */
export function runsAllowed(concurrencyLimit: number | undefined): number {
  if (concurrencyLimit === undefined || concurrencyLimit < 0) return MAX_RUNS
  return Math.min(MAX_RUNS, Math.floor(concurrencyLimit))
}

/** Stored settings from an earlier visit, with anything unknown dropped. */
export function restoreDarkroomSettings(stored: unknown): DarkroomSettings {
  const settings: DarkroomSettings = { ...DEFAULT_DARKROOM_SETTINGS }
  if (!stored || typeof stored !== 'object') return settings
  const read = (key: keyof DarkroomSettings): unknown =>
    Reflect.get(stored, key)
  const model = read('model')
  if (typeof model === 'string' && darkroomModel(model)) settings.model = model
  const runs = read('runs')
  if (typeof runs === 'number' && Number.isInteger(runs) && runs >= 1)
    settings.runs = Math.min(runs, MAX_RUNS)
  const shape = read('shape')
  if (isDarkroomShape(shape)) settings.shape = shape
  const size = read('size')
  const knownSize = DARKROOM_SIZES.find((candidate) => candidate === size)
  if (knownSize) settings.size = knownSize
  const format = read('format')
  const knownFormat = DARKROOM_FORMATS.find(
    (candidate) => candidate.value === format
  )
  if (knownFormat) settings.format = knownFormat.value
  const seed = read('seed')
  if (typeof seed === 'string' && /^\d{0,10}$/.test(seed)) settings.seed = seed
  const planning = read('planning')
  const knownPlanning = DARKROOM_PLANNING.find(
    (candidate) => candidate.value === planning
  )
  if (knownPlanning) settings.planning = knownPlanning.value
  const temperature = read('temperature')
  if (typeof temperature === 'number' && temperature >= 0 && temperature <= 2)
    settings.temperature = temperature
  const styleNotes = read('styleNotes')
  if (typeof styleNotes === 'string') settings.styleNotes = styleNotes
  return settings
}
