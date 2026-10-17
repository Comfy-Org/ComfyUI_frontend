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

const STATIC = [
  'Create a product image from a text prompt',
  'Build an image-to-video workflow',
  'Explain how a ComfyUI workflow works',
  'Find the best workflow for a specific task',
  'Diagnose and fix errors in a workflow'
] as const

const INTENT_COPY: Record<
  StarterPromptIntent | 'baseline',
  readonly [string, string, string, string]
> = {
  baseline: [STATIC[0], STATIC[1], STATIC[3], STATIC[4]],
  images: [
    'Create an image from a text prompt',
    'Build an image-generation workflow',
    'Find the best image workflow for a specific task',
    'Help me diagnose an image workflow error'
  ],
  video: [
    'Create an image for a video',
    'Build an image-to-video workflow',
    'Find the best video workflow for a specific task',
    'Help me diagnose a video workflow error'
  ],
  workflows: [
    'Create something with a workflow',
    'Build a reusable workflow',
    'Find a workflow for a specific task',
    'Help me diagnose a workflow error'
  ],
  apps_api: [
    'Create an asset for an app',
    'Build an API-ready workflow',
    'Find a workflow suitable for an API',
    'Help me diagnose an API workflow error'
  ],
  exploring: [
    'Create something to learn ComfyUI',
    'Build a simple starter workflow',
    'Show me a useful workflow to try',
    'Help me diagnose a workflow error'
  ]
}

const EXPERIENCE_COPY: Record<StarterPromptExperience | 'baseline', string> = {
  baseline: STATIC[2],
  new: 'Teach me how ComfyUI workflows work',
  some: 'Explain how a ComfyUI workflow works',
  pro: 'Explain the architecture of a ComfyUI workflow'
}

const FOCUS_COPY: Record<StarterPromptFocus, string> = {
  custom_nodes: 'Find useful custom nodes for my workflow',
  pipelines: 'Show me a production workflow pipeline',
  products: 'Show me how to integrate a workflow into a product'
}

const DISCOVER_COPY: Record<
  StarterPromptIntent | StarterPromptFocus | 'baseline',
  string
> = {
  baseline: STATIC[3],
  images: INTENT_COPY.images[2],
  video: INTENT_COPY.video[2],
  workflows: INTENT_COPY.workflows[2],
  apps_api: INTENT_COPY.apps_api[2],
  exploring: INTENT_COPY.exploring[2],
  ...FOCUS_COPY
}

const CANVAS_PRESENT = {
  learn: 'Explain this workflow',
  discover: 'Suggest the next improvement to this workflow',
  repair: 'Diagnose and fix errors in this workflow'
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
  locale: string
  profile: StarterPromptProfile | null
  canvasPresence: CanvasPresence
}): StarterPromptSelection {
  const usesProfile = ['profile', 'profile_canvas'].includes(input.strategy)
  const usesCanvas = ['canvas', 'profile_canvas'].includes(input.strategy)
  const profile = usesProfile ? input.profile : null
  const profilePrompts = promptsForProfile(profile)
  const canvasPresent = usesCanvas && input.canvasPresence === 'present'

  const prompts = canvasPresent
    ? ([
        profilePrompts[0],
        profilePrompts[1],
        CANVAS_PRESENT.learn,
        CANVAS_PRESENT.discover,
        CANVAS_PRESENT.repair
      ] as const)
    : profilePrompts

  return Object.freeze({
    prompts,
    strategy: input.strategy,
    catalogVersion: 'v2.0-en-draft',
    personalizationApplied: prompts.some(
      (prompt, index) => prompt !== STATIC[index]
    ),
    profileSource: profile ? 'survey' : 'unavailable',
    canvasPresence: input.canvasPresence,
    locale: 'en'
  })
}

function promptsForProfile(
  profile: StarterPromptProfile | null
): readonly [string, string, string, string, string] {
  const intentKey = profile?.intent ?? 'baseline'
  const intentCopy = INTENT_COPY[intentKey]
  const learn = EXPERIENCE_COPY[profile?.experience ?? 'baseline']
  const discover = DISCOVER_COPY[profile?.focus ?? intentKey]

  return [intentCopy[0], intentCopy[1], learn, discover, intentCopy[3]]
}
