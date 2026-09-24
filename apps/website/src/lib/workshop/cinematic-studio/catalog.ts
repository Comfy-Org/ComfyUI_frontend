import type { WorkshopModelDetail } from '../../../config/models-catalogue'
import type { CinematicCopyKey } from './copy'

type CameraPart = 'body' | 'lens' | 'focal' | 'aperture'
export type LookPart = 'shot' | 'light' | 'film' | 'look'
export type DirectionPart = CameraPart | LookPart | 'grade'

export interface DirectionOption {
  readonly id: string
  readonly label: CinematicCopyKey
  /** Words this choice adds to the prompt. Empty for Auto. */
  readonly phrase: string
  readonly preview?: string
  readonly palette?: readonly string[]
}

export interface DirectionGroup<P extends DirectionPart = DirectionPart> {
  readonly part: P
  readonly title: CinematicCopyKey
  readonly options: readonly DirectionOption[]
}

export type Direction = Readonly<Record<DirectionPart, string>>

const frame = (name: string) => `/images/cinematic-studio/${name}.jpg`

const auto: DirectionOption = {
  id: 'auto',
  label: 'cinematic.option.auto',
  phrase: ''
}

export const cameraGroups: readonly DirectionGroup[] = [
  {
    part: 'body',
    title: 'cinematic.camera.body',
    options: [
      auto,
      {
        id: 'digital',
        label: 'cinematic.option.digital',
        phrase: 'digital cinema camera'
      },
      {
        id: 'large',
        label: 'cinematic.option.largeFormat',
        phrase: 'large format cinema camera'
      },
      {
        id: 'super35',
        label: 'cinematic.option.super35',
        phrase: 'Super 35 sensor'
      },
      {
        id: 'film35',
        label: 'cinematic.option.film35',
        phrase: '35mm film camera'
      },
      {
        id: 'film16',
        label: 'cinematic.option.film16',
        phrase: '16mm film camera'
      },
      {
        id: 'handheld',
        label: 'cinematic.option.handheld',
        phrase: 'handheld documentary camera'
      }
    ]
  },
  {
    part: 'lens',
    title: 'cinematic.camera.lens',
    options: [
      auto,
      {
        id: 'prime',
        label: 'cinematic.option.prime',
        phrase: 'spherical prime lens'
      },
      {
        id: 'anamorphic',
        label: 'cinematic.option.anamorphic',
        phrase: 'anamorphic lens'
      },
      {
        id: 'vintage',
        label: 'cinematic.option.vintage',
        phrase: 'vintage lens'
      },
      { id: 'macro', label: 'cinematic.option.macro', phrase: 'macro lens' },
      {
        id: 'tilt',
        label: 'cinematic.option.tiltShift',
        phrase: 'tilt-shift lens'
      }
    ]
  },
  {
    part: 'focal',
    title: 'cinematic.camera.focal',
    options: [
      auto,
      ...(
        [
          ['14', 'cinematic.option.mm14'],
          ['24', 'cinematic.option.mm24'],
          ['35', 'cinematic.option.mm35'],
          ['50', 'cinematic.option.mm50'],
          ['85', 'cinematic.option.mm85'],
          ['135', 'cinematic.option.mm135']
        ] as const satisfies readonly (readonly [string, CinematicCopyKey])[]
      ).map(([mm, label]) => ({ id: mm, label, phrase: `${mm}mm` }))
    ]
  },
  {
    part: 'aperture',
    title: 'cinematic.camera.aperture',
    options: [
      auto,
      ...(
        [
          ['1.4', 'cinematic.option.f14'],
          ['2', 'cinematic.option.f2'],
          ['2.8', 'cinematic.option.f28'],
          ['4', 'cinematic.option.f4'],
          ['8', 'cinematic.option.f8']
        ] as const satisfies readonly (readonly [string, CinematicCopyKey])[]
      ).map(([stop, label]) => ({ id: stop, label, phrase: `f/${stop}` }))
    ]
  }
]

export const lookGroups: readonly DirectionGroup<LookPart>[] = [
  {
    part: 'shot',
    title: 'cinematic.part.shot',
    options: [
      auto,
      {
        id: 'xwide',
        label: 'cinematic.option.extremeWide',
        phrase: 'extreme wide shot',
        preview: frame('desert')
      },
      {
        id: 'wide',
        label: 'cinematic.option.wide',
        phrase: 'wide shot',
        preview: frame('motel')
      },
      {
        id: 'medium',
        label: 'cinematic.option.medium',
        phrase: 'medium shot',
        preview: frame('bus-stop')
      },
      {
        id: 'close',
        label: 'cinematic.option.closeUp',
        phrase: 'close-up',
        preview: frame('letter')
      },
      {
        id: 'xclose',
        label: 'cinematic.option.extremeCloseUp',
        phrase: 'extreme close-up',
        preview: frame('portrait')
      },
      {
        id: 'ots',
        label: 'cinematic.option.overShoulder',
        phrase: 'over-the-shoulder shot',
        preview: frame('train')
      },
      {
        id: 'low',
        label: 'cinematic.option.lowAngle',
        phrase: 'low angle shot',
        preview: frame('neon-street')
      }
    ]
  },
  {
    part: 'light',
    title: 'cinematic.part.light',
    options: [
      auto,
      {
        id: 'golden',
        label: 'cinematic.option.goldenHour',
        phrase: 'golden hour sunlight',
        preview: frame('motel')
      },
      {
        id: 'overcast',
        label: 'cinematic.option.overcast',
        phrase: 'soft overcast daylight',
        preview: frame('portrait')
      },
      {
        id: 'blue',
        label: 'cinematic.option.blueHour',
        phrase: 'blue hour twilight',
        preview: frame('train')
      },
      {
        id: 'night',
        label: 'cinematic.option.practicalNight',
        phrase: 'night lit by practical lights',
        preview: frame('bus-stop')
      },
      {
        id: 'neon',
        label: 'cinematic.option.neon',
        phrase: 'neon light',
        preview: frame('diner')
      },
      {
        id: 'lowkey',
        label: 'cinematic.option.lowKey',
        phrase: 'low key lighting',
        preview: frame('letter')
      },
      {
        id: 'silhouette',
        label: 'cinematic.option.silhouette',
        phrase: 'backlit silhouette',
        preview: frame('desert')
      }
    ]
  },
  {
    part: 'film',
    title: 'cinematic.part.film',
    options: [
      auto,
      {
        id: 'clean',
        label: 'cinematic.option.digitalClean',
        phrase: 'clean digital image',
        preview: frame('bus-stop')
      },
      {
        id: 't500',
        label: 'cinematic.option.tungsten500',
        phrase: 'tungsten 500T film',
        preview: frame('bus-stop')
      },
      {
        id: 'd250',
        label: 'cinematic.option.daylight250',
        phrase: 'daylight 250D film',
        preview: frame('motel')
      },
      {
        id: 'bw400',
        label: 'cinematic.option.blackWhite400',
        phrase: 'black and white 400 film',
        preview: frame('portrait')
      },
      {
        id: 'slide',
        label: 'cinematic.option.reversal',
        phrase: 'reversal slide film',
        preview: frame('diner')
      },
      {
        id: 'expired',
        label: 'cinematic.option.expired',
        phrase: 'expired film',
        preview: frame('desert')
      },
      {
        id: 'bleach',
        label: 'cinematic.option.bleachBypass',
        phrase: 'bleach bypass',
        preview: frame('letter')
      }
    ]
  },
  {
    part: 'look',
    title: 'cinematic.part.look',
    options: [
      auto,
      {
        id: 'neonoir',
        label: 'cinematic.option.neoNoir',
        phrase: 'neo-noir look',
        preview: frame('neon-street')
      },
      {
        id: 'western',
        label: 'cinematic.option.western',
        phrase: 'western look',
        preview: frame('desert')
      },
      {
        id: 'scifi',
        label: 'cinematic.option.sciFi',
        phrase: 'science fiction look',
        preview: frame('diner')
      },
      {
        id: 'drama',
        label: 'cinematic.option.periodDrama',
        phrase: 'period drama look',
        preview: frame('motel')
      },
      {
        id: 'thriller',
        label: 'cinematic.option.thriller',
        phrase: 'thriller look',
        preview: frame('red-coat')
      },
      {
        id: 'doc',
        label: 'cinematic.option.documentary',
        phrase: 'documentary look',
        preview: frame('portrait')
      },
      {
        id: 'road',
        label: 'cinematic.option.roadMovie',
        phrase: 'road movie look',
        preview: frame('train')
      }
    ]
  }
]

export const gradeGroup: DirectionGroup = {
  part: 'grade',
  title: 'cinematic.part.grade',
  options: [
    {
      ...auto,
      palette: ['#2a2330', '#3a3240', '#6e6875', '#8a8490', '#c2bfb9']
    },
    {
      id: 'teal',
      label: 'cinematic.option.tealOrange',
      phrase: 'teal and orange grade',
      palette: ['#0f2a36', '#1f5f6a', '#6f9aa0', '#e0a15e', '#f2c28b']
    },
    {
      id: 'noir',
      label: 'cinematic.option.noir',
      phrase: 'black and white grade',
      palette: ['#0b0b0c', '#2b2b2e', '#6e6e73', '#bdbdc2', '#f0efed']
    },
    {
      id: 'kodachrome',
      label: 'cinematic.option.kodachrome',
      phrase: 'Kodachrome tones',
      palette: ['#1f3a5f', '#3d6b4f', '#c7462e', '#e8c35a', '#efe2c4']
    },
    {
      id: 'neon',
      label: 'cinematic.option.neonNight',
      phrase: 'magenta and cyan palette',
      palette: ['#0d0a26', '#3b1b6e', '#ff3d8b', '#27d3f2', '#e6d8ff']
    },
    {
      id: 'desert',
      label: 'cinematic.option.desertDust',
      phrase: 'warm desert palette',
      palette: ['#3a2414', '#8a5a34', '#c99a6a', '#e2b98a', '#f6e2bd']
    },
    {
      id: 'nordic',
      label: 'cinematic.option.nordicCold',
      phrase: 'cold blue-grey palette',
      palette: ['#0d1318', '#1c2630', '#3f5566', '#8aa3b3', '#e6eef2']
    }
  ]
}

const directionGroups: readonly DirectionGroup[] = [
  ...cameraGroups,
  ...lookGroups,
  gradeGroup
]

export const AUTO_DIRECTION: Direction = {
  body: 'auto',
  lens: 'auto',
  focal: 'auto',
  aperture: 'auto',
  shot: 'auto',
  light: 'auto',
  film: 'auto',
  look: 'auto',
  grade: 'auto'
}

export const DEFAULT_DIRECTION: Direction = {
  body: 'large',
  lens: 'anamorphic',
  focal: '50',
  aperture: '2.8',
  shot: 'medium',
  light: 'night',
  film: 't500',
  look: 'neonoir',
  grade: 'teal'
}

export function directionOption(
  part: DirectionPart,
  direction: Direction
): DirectionOption {
  const group = directionGroups.find((candidate) => candidate.part === part)
  if (!group) throw new Error(`Unknown direction part: ${part}`)
  return (
    group.options.find((option) => option.id === direction[part]) ??
    group.options[0]
  )
}

type RunnableModel = Pick<
  WorkshopModelDetail,
  'slug' | 'name' | 'provider' | 'execution'
>

export interface CinematicModel {
  readonly slug: string
  readonly name: string
  readonly provider: string
  readonly logo: string
}

/** Image models the studio can route to, by Router page slug. */
const CINEMATIC_MODEL_LOGOS: Readonly<Record<string, string>> = {
  'byteplus--seedream-4-5--generate-images': '/icons/ai-models/bytedance.svg',
  'vertexai--gemini-3-pro-image--generate-images':
    '/icons/ai-models/gemini.svg',
  'bfl--flux-2-pro--generate-images': '/icons/ai-models/bfl.svg',
  'krea--krea-2-large--generate-images': '/icons/ai-models/krea.svg',
  'qwen--qwen-image-3.0-pro-text-to-image--generate-images':
    '/icons/ai-models/qwen.svg'
}

export const ASPECT_RATIOS = [
  { id: '21:9', label: 'cinematic.aspect.scope' },
  { id: '16:9', label: 'cinematic.aspect.widescreen' },
  { id: '4:3', label: 'cinematic.aspect.academy' },
  { id: '1:1', label: 'cinematic.aspect.square' },
  { id: '9:16', label: 'cinematic.aspect.vertical' }
] as const satisfies readonly { id: string; label: CinematicCopyKey }[]

export type AspectRatio = (typeof ASPECT_RATIOS)[number]['id']

/** Short-side pixels. The Router mapping snaps these to each model's sizes. */
export const RESOLUTIONS = [
  { id: '1K', pixels: 1024 },
  { id: '2K', pixels: 2048 }
] as const

export type Resolution = (typeof RESOLUTIONS)[number]['id']

export const MAX_TAKES = 4

export function runnableCinematicModels(
  lookup: (slug: string) => RunnableModel | undefined
): readonly CinematicModel[] {
  const models = Object.entries(CINEMATIC_MODEL_LOGOS).flatMap(
    ([slug, logo]) => {
      const model = lookup(slug)
      return model?.execution
        ? [
            {
              slug: model.slug,
              name: model.name,
              provider: model.provider ?? '',
              logo
            }
          ]
        : []
    }
  )
  if (!models.length) throw new Error('Cinematic Studio has no runnable models')
  return models
}
