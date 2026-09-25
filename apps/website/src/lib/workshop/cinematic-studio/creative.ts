/** Creative directions guide the model; they do not simulate optics or lighting. */
export const GENRES = [
  'auto',
  'drama',
  'noir',
  'comedy',
  'horror',
  'action',
  'adventure',
  'epic',
  'documentary'
] as const
export const ERAS = [
  'auto',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2020s'
] as const
export const TEMPOS = ['auto', 'single', 'calm', 'dynamic', 'chaotic'] as const
export const LIGHT_POSITIONS = [
  'front',
  'left',
  'right',
  'back',
  'top',
  'bottom'
] as const
export const MOVEMENTS = [
  ['static', 'Locked camera; movement comes from the scene.'],
  ['dolly-in', 'Camera moves slowly forward toward the subject.'],
  ['dolly-out', 'Camera moves backward revealing the environment.'],
  ['pan-left', 'Camera pans left from a fixed position.'],
  ['pan-right', 'Camera pans right from a fixed position.'],
  ['tilt-up', 'Camera tilts upward.'],
  ['tilt-down', 'Camera tilts downward.'],
  ['tracking', 'Camera follows the subject through the scene.'],
  ['side-tracking', 'Camera tracks alongside the moving subject.'],
  ['handheld', 'Subtle motivated handheld camera movement.'],
  [
    'rack-focus',
    'Focus shifts deliberately between foreground and background.'
  ],
  ['drone-orbit', 'An elevated camera orbits the subject.'],
  ['arc-left', 'Camera arcs to the left around the subject.'],
  ['arc-right', 'Camera arcs to the right around the subject.'],
  ['crane-up', 'Camera rises in a sweeping crane movement.'],
  ['crane-down', 'Camera descends in a sweeping crane movement.'],
  ['pedestal-up', 'Camera rises vertically without tilting.'],
  ['pedestal-down', 'Camera lowers vertically without tilting.'],
  ['truck-left', 'Camera moves laterally to the left.'],
  ['truck-right', 'Camera moves laterally to the right.'],
  ['slider-left', 'Short smooth slider move to the left.'],
  ['slider-right', 'Short smooth slider move to the right.'],
  ['slow-zoom-in', 'Lens slowly zooms in from a fixed camera.'],
  ['slow-zoom-out', 'Lens slowly zooms out from a fixed camera.'],
  [
    'dolly-zoom',
    'Camera dollies while compensating with zoom, changing background perspective.'
  ],
  ['whip-pan', 'A fast whip pan with directional motion blur.'],
  ['crush-zoom', 'A sudden rapid zoom toward the subject.'],
  ['aerial-pullback', 'Aerial camera pulls away to reveal the landscape.'],
  ['helicopter', 'Broad sweeping aerial tracking shot.'],
  ['pov', 'First-person camera perspective follows the action.'],
  [
    'snorricam',
    'Camera stays fixed relative to the subject as the background moves.'
  ],
  ['robot-arm', 'Precise mechanically smooth camera sweep.'],
  ['bullet-time', 'Camera orbits a moment of nearly frozen action.']
] as const

export type Movement = (typeof MOVEMENTS)[number][0]
interface CreativeLight {
  position: (typeof LIGHT_POSITIONS)[number]
  color: string
  brightness: number
  diffusion: number
}
export interface CreativeSettings {
  genre: (typeof GENRES)[number]
  era: (typeof ERAS)[number]
  tempo: (typeof TEMPOS)[number]
  movements: Movement[]
  palette: string[]
  paletteMain: number | null
  lights: CreativeLight[]
}
export function defaultCreativeSettings(): CreativeSettings {
  return {
    genre: 'auto',
    era: 'auto',
    tempo: 'auto',
    movements: [],
    palette: [],
    paletteMain: null,
    lights: []
  }
}

const hex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid creative settings')
  return Object.fromEntries(Object.entries(value))
}
function option<T extends string>(choices: readonly T[], value: unknown): T {
  const found = choices.find((choice) => choice === value)
  if (!found) throw new Error('Invalid creative option')
  return found
}
export function validateCreativeSettings(value: unknown): CreativeSettings {
  const input = object(value)
  if (
    !Array.isArray(input.movements) ||
    input.movements.length > 4 ||
    new Set(input.movements).size !== input.movements.length
  )
    throw new Error('Choose up to four distinct movements')
  if (
    !Array.isArray(input.palette) ||
    input.palette.length > 8 ||
    !input.palette.every(hex)
  )
    throw new Error('Choose up to eight valid colors')
  const palette = input.palette.map((color) => color.toLowerCase())
  const main = input.paletteMain
  if (
    main !== null &&
    (typeof main !== 'number' ||
      !Number.isInteger(main) ||
      main < 0 ||
      main >= palette.length)
  )
    throw new Error('Invalid main color')
  if (!Array.isArray(input.lights) || input.lights.length > 3)
    throw new Error('Choose up to three lights')
  const lights = input.lights.map((value) => {
    const light = object(value)
    if (
      !hex(light.color) ||
      typeof light.brightness !== 'number' ||
      typeof light.diffusion !== 'number' ||
      ![light.brightness, light.diffusion].every(
        (n) => Number.isFinite(n) && n >= 0 && n <= 100
      )
    )
      throw new Error('Invalid light')
    return {
      position: option(LIGHT_POSITIONS, light.position),
      color: light.color.toLowerCase(),
      brightness: light.brightness,
      diffusion: light.diffusion
    }
  })
  return {
    genre: option(GENRES, input.genre),
    era: option(ERAS, input.era),
    tempo: option(TEMPOS, input.tempo),
    movements: input.movements.map((value) =>
      option(
        MOVEMENTS.map(([id]) => id),
        value
      )
    ),
    palette,
    paletteMain: main,
    lights
  }
}

/** A detached draft: editing or cancelling never mutates the applied settings. */
export function beginCreativeDraft(
  current: CreativeSettings
): CreativeSettings {
  return validateCreativeSettings(current)
}
export function moveCreativeColor(
  current: CreativeSettings,
  from: number,
  to: number
): CreativeSettings {
  const next = validateCreativeSettings(current)
  if (
    ![from, to].every(
      (n) => Number.isInteger(n) && n >= 0 && n < next.palette.length
    )
  )
    throw new Error('Invalid color position')
  const order = next.palette.map((_, i) => i)
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  next.palette = order.map((i) => current.palette[i])
  next.paletteMain =
    current.paletteMain === null ? null : order.indexOf(current.paletteMain)
  return next
}
export function removeCreativeColor(
  current: CreativeSettings,
  index: number
): CreativeSettings {
  const next = validateCreativeSettings(current)
  if (!Number.isInteger(index) || index < 0 || index >= next.palette.length)
    throw new Error('Invalid color position')
  next.palette.splice(index, 1)
  next.paletteMain =
    next.paletteMain === null || next.paletteMain === index
      ? null
      : next.paletteMain > index
        ? next.paletteMain - 1
        : next.paletteMain
  return next
}
export function creativePrompt(
  settings: CreativeSettings,
  mode: 'image' | 'video' = 'image'
): string {
  const s = validateCreativeSettings(settings)
  const parts: string[] = []
  if (s.genre !== 'auto')
    parts.push(`${s.genre} film storytelling and atmosphere.`)
  if (s.era !== 'auto')
    parts.push(
      `Period setting and visual language of the ${s.era}; keep story details consistent.`
    )
  if (mode === 'video') {
    const tempo = {
      auto: '',
      single: 'One continuous shot, no cuts.',
      calm: 'Patient pacing, slow deliberate action.',
      dynamic: 'Dynamic action and purposeful pacing.',
      chaotic: 'Frantic urgent action with unsettled pacing.'
    }[s.tempo]
    if (tempo) parts.push(tempo)
    if (s.movements.length)
      parts.push(
        'Camera movement, in order: ' +
          s.movements
            .map((id) => MOVEMENTS.find((move) => move[0] === id)?.[1])
            .join(' Then ')
      )
  }
  if (s.palette.length)
    parts.push(
      `Color grade: dominant colors ${s.palette.join(', ')}. Keep skin tones believable.`
    )
  if (s.paletteMain !== null)
    parts.push(
      `Palette priority: ${s.palette[s.paletteMain]} is the main color; use the other palette colors as supporting accents. Preserve believable skin tones and readable contrast.`
    )
  if (s.lights.length)
    parts.push(
      'Motivated lighting: ' +
        s.lights
          .map(
            (light) =>
              `${light.position} light, ${light.color}, ${light.brightness}% relative brightness, ${light.diffusion}% diffusion`
          )
          .join('; ') +
        '.'
    )
  return parts.join('\n')
}

export const HARMONIES = [
  'analogous',
  'complementary',
  'split',
  'triad',
  'tetradic',
  'square',
  'monochrome'
] as const
export function creativeHarmony(
  color: string,
  scheme: (typeof HARMONIES)[number]
): string[] {
  if (!hex(color)) throw new Error('Invalid color')
  const rgb = [1, 3, 5].map(
    (start) => parseInt(color.slice(start, start + 2), 16) / 255
  )
  const [r, g, b] = rgb
  const max = Math.max(...rgb),
    min = Math.min(...rgb),
    delta = max - min,
    l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  const h =
    ((delta === 0
      ? 0
      : max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4)) +
      360) %
    360
  const offsets = {
    analogous: [-30, -15, 15, 30],
    complementary: [180],
    split: [150, 210],
    triad: [120, 240],
    tetradic: [60, 180, 240],
    square: [90, 180, 270],
    monochrome: [0, 0, 0, 0]
  }[scheme]
  return [
    color.toLowerCase(),
    ...offsets.map((offset, i) => {
      const light = scheme === 'monochrome' ? [0.15, 0.35, 0.65, 0.85][i] : l
      const hue = (h + offset + 360) % 360
      const a = s * Math.min(light, 1 - light)
      const f = (n: number) => {
        const k = (n + hue / 30) % 12
        return Math.round(
          255 * (light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))
        )
          .toString(16)
          .padStart(2, '0')
      }
      return '#' + f(0) + f(8) + f(4)
    })
  ]
}

export interface CreativePreset {
  name: string
  settings: CreativeSettings
}
export function parseCreativePresets(raw: string | null): CreativePreset[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(values)) return []
    return values
      .flatMap((value) => {
        try {
          const item = object(value)
          return typeof item.name === 'string' && item.name.trim()
            ? [
                {
                  name: item.name.slice(0, 60),
                  settings: validateCreativeSettings(item.settings)
                }
              ]
            : []
        } catch {
          return []
        }
      })
      .slice(-16)
  } catch {
    return []
  }
}
