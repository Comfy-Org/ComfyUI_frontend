import { onMounted, ref, watch } from 'vue'

export const RUN_OUTCOMES = [
  'success',
  'nsfw',
  'validation',
  'provider',
  'rateLimit'
] as const
export type RunOutcome = (typeof RUN_OUTCOMES)[number]

export const MODEL_STATES = ['none', 'policy', 'unavailable'] as const
export type ModelState = (typeof MODEL_STATES)[number]

// V1 is the models playground (11 Sep); V2 adds workflows and Deploy (GA 30 Sep).
export const SCOPES = ['v1', 'v2'] as const
export type Scope = (typeof SCOPES)[number]

export const OUTPUT_COUNTS = [1, 4, 9] as const
type OutputCount = (typeof OUTPUT_COUNTS)[number]

const SCOPE_KEY = 'comfy-workshop-scope'

const outcome = ref<RunOutcome>('success')
const modelState = ref<ModelState>('none')
const scope = ref<Scope>('v1')
// Deprecated and degraded models are invented cases: hidden unless asked for.
const showStatuses = ref(false)
const outputCount = ref<OutputCount>(1)
let hydrated = false

function isScope(value: unknown): value is Scope {
  return (
    typeof value === 'string' && (SCOPES as readonly string[]).includes(value)
  )
}

watch(scope, (value) => {
  try {
    localStorage.setItem(SCOPE_KEY, value)
  } catch {
    /* storage unavailable */
  }
})

// Shared across islands so the tweaks panel drives the whole prototype.
export function usePrototypeTweaks() {
  onMounted(() => {
    if (hydrated) return
    hydrated = true
    try {
      const stored = localStorage.getItem(SCOPE_KEY)
      if (isScope(stored)) scope.value = stored
    } catch {
      /* storage unavailable */
    }
  })
  return { outcome, modelState, scope, showStatuses, outputCount }
}
