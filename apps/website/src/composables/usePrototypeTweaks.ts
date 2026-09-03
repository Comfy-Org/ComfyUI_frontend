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

export const OUTPUT_COUNTS = [1, 4, 9] as const
type OutputCount = (typeof OUTPUT_COUNTS)[number]

// One control for the whole prototype: V1 is the flat models catalog (11 Sep),
// V1.1 opens that same catalog as browseable rows per use case, V1.2 moves the
// categories into a rail beside the grid, and V2 is the screen where workflows,
// apps and models live together (GA 30 Sep).
export const VERSIONS = ['v1', 'v1.1', 'v1.2', 'v2'] as const
export type Version = (typeof VERSIONS)[number]

const VERSION_KEY = 'comfy-workshop-version'

const outcome = ref<RunOutcome>('success')
const modelState = ref<ModelState>('none')
const version = ref<Version>('v1')
// Deprecated and degraded models are invented cases: hidden unless asked for.
const showStatuses = ref(false)
const outputCount = ref<OutputCount>(1)
// The catalogue lists one card per model, as the TDD describes. Grouping the
// releases of a family behind the newest is an unsettled variant.
const groupVersions = ref(false)
let hydrated = false

function isVersion(value: unknown): value is Version {
  return (
    typeof value === 'string' && (VERSIONS as readonly string[]).includes(value)
  )
}

watch(version, (value) => {
  try {
    localStorage.setItem(VERSION_KEY, value)
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
      const stored = localStorage.getItem(VERSION_KEY)
      if (isVersion(stored)) version.value = stored
    } catch {
      /* storage unavailable */
    }
  })
  return {
    outcome,
    modelState,
    version,
    showStatuses,
    outputCount,
    groupVersions
  }
}
