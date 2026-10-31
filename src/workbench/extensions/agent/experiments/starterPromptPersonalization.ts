import { i18n } from '@/i18n'

export type StarterPromptStrategy =
  | 'static'
  | 'profile'
  | 'canvas'
  | 'profile_canvas'

type StarterPromptIntent =
  | 'images'
  | 'video'
  | 'workflows'
  | 'apps_api'
  | 'exploring'

type StarterPromptExperience = 'new' | 'some' | 'pro'
type StarterPromptFocus = 'custom_nodes' | 'pipelines' | 'products'
export type CanvasPresence = 'empty' | 'present'

export interface StarterPromptProfile {
  intent?: StarterPromptIntent
  experience?: StarterPromptExperience
  focus?: StarterPromptFocus
}

export interface StarterPromptSelection {
  prompts: readonly [string, string, string, string, string]
  strategy: StarterPromptStrategy
  catalogVersion: 'v2.0-en-draft'
  personalizationApplied: boolean
  profileSource: 'survey' | 'unavailable'
  canvasPresence: CanvasPresence
  locale: 'en'
}

type StarterPromptTranslationKey =
  `agent.suggestedPrompts.treatment.personalizedV2.${string}`

const STATIC_KEYS = [
  'agent.suggestedPrompts.treatment.personalizedV2.static.create',
  'agent.suggestedPrompts.treatment.personalizedV2.static.build',
  'agent.suggestedPrompts.treatment.personalizedV2.static.learn',
  'agent.suggestedPrompts.treatment.personalizedV2.static.discover',
  'agent.suggestedPrompts.treatment.personalizedV2.static.repair'
] as const

const INTENT_COPY: Record<
  StarterPromptIntent | 'baseline',
  readonly [
    StarterPromptTranslationKey,
    StarterPromptTranslationKey,
    StarterPromptTranslationKey,
    StarterPromptTranslationKey
  ]
> = {
  baseline: [STATIC_KEYS[0], STATIC_KEYS[1], STATIC_KEYS[3], STATIC_KEYS[4]],
  images: [
    'agent.suggestedPrompts.treatment.personalizedV2.intent.images.create',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.images.build',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.images.discover',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.images.repair'
  ],
  video: [
    'agent.suggestedPrompts.treatment.personalizedV2.intent.video.create',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.video.build',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.video.discover',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.video.repair'
  ],
  workflows: [
    'agent.suggestedPrompts.treatment.personalizedV2.intent.workflows.create',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.workflows.build',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.workflows.discover',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.workflows.repair'
  ],
  apps_api: [
    'agent.suggestedPrompts.treatment.personalizedV2.intent.appsApi.create',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.appsApi.build',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.appsApi.discover',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.appsApi.repair'
  ],
  exploring: [
    'agent.suggestedPrompts.treatment.personalizedV2.intent.exploring.create',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.exploring.build',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.exploring.discover',
    'agent.suggestedPrompts.treatment.personalizedV2.intent.exploring.repair'
  ]
}

const EXPERIENCE_COPY: Record<
  StarterPromptExperience | 'baseline',
  StarterPromptTranslationKey
> = {
  baseline: STATIC_KEYS[2],
  new: 'agent.suggestedPrompts.treatment.personalizedV2.experience.new',
  some: 'agent.suggestedPrompts.treatment.personalizedV2.experience.some',
  pro: 'agent.suggestedPrompts.treatment.personalizedV2.experience.pro'
}

const FOCUS_COPY: Record<StarterPromptFocus, StarterPromptTranslationKey> = {
  custom_nodes:
    'agent.suggestedPrompts.treatment.personalizedV2.focus.customNodes',
  pipelines: 'agent.suggestedPrompts.treatment.personalizedV2.focus.pipelines',
  products: 'agent.suggestedPrompts.treatment.personalizedV2.focus.products'
}

const DISCOVER_COPY: Record<
  StarterPromptIntent | StarterPromptFocus | 'baseline',
  StarterPromptTranslationKey
> = {
  baseline: STATIC_KEYS[3],
  images: INTENT_COPY.images[2],
  video: INTENT_COPY.video[2],
  workflows: INTENT_COPY.workflows[2],
  apps_api: INTENT_COPY.apps_api[2],
  exploring: INTENT_COPY.exploring[2],
  ...FOCUS_COPY
}

const CANVAS_PRESENT = {
  learn: 'agent.suggestedPrompts.treatment.personalizedV2.canvas.learn',
  discover: 'agent.suggestedPrompts.treatment.personalizedV2.canvas.discover',
  repair: 'agent.suggestedPrompts.treatment.personalizedV2.canvas.repair'
} as const

const intents = new Set<StarterPromptIntent>([
  'images',
  'video',
  'workflows',
  'apps_api',
  'exploring'
])
const experiences = new Set<StarterPromptExperience>(['new', 'some', 'pro'])
const focuses = new Set<StarterPromptFocus>([
  'custom_nodes',
  'pipelines',
  'products'
])

export function normalizeStarterPromptProfile(
  value: unknown
): StarterPromptProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const intent = intents.has(candidate.intent as StarterPromptIntent)
    ? (candidate.intent as StarterPromptIntent)
    : candidate.intent === 'other'
      ? 'exploring'
      : undefined
  const experience = experiences.has(
    candidate.experience as StarterPromptExperience
  )
    ? (candidate.experience as StarterPromptExperience)
    : undefined
  const focus =
    (intent === 'workflows' || intent === 'apps_api') &&
    focuses.has(candidate.focus as StarterPromptFocus)
      ? (candidate.focus as StarterPromptFocus)
      : undefined

  if (!intent && !experience) return null
  return {
    ...(intent ? { intent } : {}),
    ...(experience ? { experience } : {}),
    ...(focus ? { focus } : {})
  }
}

export function selectStarterPrompts(input: {
  strategy: StarterPromptStrategy
  profile: StarterPromptProfile | null
  canvasPresence: CanvasPresence
}): StarterPromptSelection {
  const usesProfile = ['profile', 'profile_canvas'].includes(input.strategy)
  const usesCanvas = ['canvas', 'profile_canvas'].includes(input.strategy)
  const profile = usesProfile ? input.profile : null
  const profilePrompts = promptsForProfile(profile)
  const canvasPresent = usesCanvas && input.canvasPresence === 'present'

  const promptKeys = canvasPresent
    ? ([
        profilePrompts[0],
        profilePrompts[1],
        CANVAS_PRESENT.learn,
        CANVAS_PRESENT.discover,
        CANVAS_PRESENT.repair
      ] as const)
    : profilePrompts
  const prompts = translatePrompts(promptKeys)

  return Object.freeze({
    prompts,
    strategy: input.strategy,
    catalogVersion: 'v2.0-en-draft',
    personalizationApplied: promptKeys.some(
      (prompt, index) => prompt !== STATIC_KEYS[index]
    ),
    profileSource: profile ? 'survey' : 'unavailable',
    canvasPresence: input.canvasPresence,
    locale: 'en'
  })
}

function promptsForProfile(
  profile: StarterPromptProfile | null
): readonly [
  StarterPromptTranslationKey,
  StarterPromptTranslationKey,
  StarterPromptTranslationKey,
  StarterPromptTranslationKey,
  StarterPromptTranslationKey
] {
  const intentKey = profile?.intent ?? 'baseline'
  const intentCopy = INTENT_COPY[intentKey]
  const learn = EXPERIENCE_COPY[profile?.experience ?? 'baseline']
  const supportsFocus = intentKey === 'workflows' || intentKey === 'apps_api'
  const discover =
    DISCOVER_COPY[supportsFocus && profile?.focus ? profile.focus : intentKey]

  return [intentCopy[0], intentCopy[1], learn, discover, intentCopy[3]]
}

function translatePrompts(
  keys: readonly [
    StarterPromptTranslationKey,
    StarterPromptTranslationKey,
    StarterPromptTranslationKey,
    StarterPromptTranslationKey,
    StarterPromptTranslationKey
  ]
): readonly [string, string, string, string, string] {
  return [
    translateEnglish(keys[0]),
    translateEnglish(keys[1]),
    translateEnglish(keys[2]),
    translateEnglish(keys[3]),
    translateEnglish(keys[4])
  ]
}

function translateEnglish(key: StarterPromptTranslationKey): string {
  return i18n.global.t(key, {}, { locale: 'en' })
}
