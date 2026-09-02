import { onMounted, ref, watch } from 'vue'

export const RUN_OUTCOMES = [
  'success',
  'nsfw',
  'expired',
  'validation',
  'provider',
  'rateLimit',
  'timeout'
] as const
export type RunOutcome = (typeof RUN_OUTCOMES)[number]

export const MODEL_STATES = [
  'none',
  'degraded',
  'deprecated',
  'policy',
  'unavailable'
] as const
export type ModelState = (typeof MODEL_STATES)[number]

// V1 is the models playground (11 Sep); V2 adds workflows and Deploy (GA 30 Sep).
export const SCOPES = ['v1', 'v2'] as const
export type Scope = (typeof SCOPES)[number]

export const OUTPUT_COUNTS = [1, 4, 9] as const
type OutputCount = (typeof OUTPUT_COUNTS)[number]

// Where /workshop starts: a first screen shaped like comfy.org/workflows with
// partner models mixed in (default), or the dedicated models catalog.
export const ENTRIES = ['hub', 'workshop'] as const
export type Entry = (typeof ENTRIES)[number]

const SCOPE_KEY = 'comfy-workshop-scope'
const ENTRY_KEY = 'comfy-workshop-entry'

const outcome = ref<RunOutcome>('success')
const modelState = ref<ModelState>('none')
const scope = ref<Scope>('v1')
const entry = ref<Entry>('hub')
// Deprecated and degraded models are invented cases: hidden unless asked for.
const showStatuses = ref(false)
const outputCount = ref<OutputCount>(1)
let hydrated = false

function isScope(value: unknown): value is Scope {
  return (
    typeof value === 'string' && (SCOPES as readonly string[]).includes(value)
  )
}

function isEntry(value: unknown): value is Entry {
  return (
    typeof value === 'string' && (ENTRIES as readonly string[]).includes(value)
  )
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

watch(scope, (value) => persist(SCOPE_KEY, value))
watch(entry, (value) => persist(ENTRY_KEY, value))

// Shared across islands so the tweaks panel drives the whole prototype.
export function usePrototypeTweaks() {
  onMounted(() => {
    if (hydrated) return
    hydrated = true
    try {
      const storedScope = localStorage.getItem(SCOPE_KEY)
      if (isScope(storedScope)) scope.value = storedScope
      const storedEntry = localStorage.getItem(ENTRY_KEY)
      if (isEntry(storedEntry)) entry.value = storedEntry
    } catch {
      /* storage unavailable */
    }
  })
  return { outcome, modelState, scope, entry, showStatuses, outputCount }
}
