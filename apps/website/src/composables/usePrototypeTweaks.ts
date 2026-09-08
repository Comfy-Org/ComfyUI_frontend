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

// One control for the whole prototype. V1 is the models catalogue with its
// categories in a rail beside the grid (11 Sep) and V2 is the screen where
// workflows, apps and models live together (GA 30 Sep), carrying its use cases
// in that same rail. The two takes V1 beat, the rows per use case and the tabs
// the catalogue shipped with, are kept as discarded options rather than
// deleted, and sit last. The ids stay as they were so the links already shared
// keep working.
export const VERSIONS = ['v1.2', 'v2', 'v1.1', 'v1'] as const

// V2's own rail test won the comparison and became V2 itself, so a link that
// still asks for it lands on the screen it was pointing at.
const RETIRED: Record<string, Version> = { 'v2.1': 'v2' }
export type Version = (typeof VERSIONS)[number]

const VERSION_KEY = 'comfy-workshop-version'

const outcome = ref<RunOutcome>('success')
const modelState = ref<ModelState>('none')
const version = ref<Version>('v1.2')
// Deprecated and degraded models are invented cases: hidden unless asked for.
const showStatuses = ref(false)
// The catalogue lists one card per model, as the TDD describes. Grouping the
// releases of a family behind the newest is an unsettled variant.
const groupVersions = ref(false)
let hydrated = false

function isVersion(value: unknown): value is Version {
  return (
    typeof value === 'string' && (VERSIONS as readonly string[]).includes(value)
  )
}

function asVersion(value: string | null): Version | undefined {
  if (value === null) return undefined
  return isVersion(value) ? value : RETIRED[value]
}

function remember(value: Version) {
  try {
    localStorage.setItem(VERSION_KEY, value)
  } catch {
    /* storage unavailable */
  }
}

watch(version, remember)

// Shared across islands so the tweaks panel drives the whole prototype.
export function usePrototypeTweaks() {
  onMounted(() => {
    if (hydrated) return
    hydrated = true
    // ?v=v1.1 makes a version linkable, so a ticket or a Slack message can
    // point at the variant it is about instead of describing how to reach it.
    // The panel's own share links spell the key out, and both have to win over
    // the browser's memory: whichever island mounts first, the link decides.
    const params = new URLSearchParams(location.search)
    const asked = asVersion(params.get('v') ?? params.get('version'))
    if (asked) {
      // A link to the version already open still has to be the one the next
      // visit reopens, and that assignment changes nothing to watch.
      version.value = asked
      remember(asked)
      return
    }
    try {
      const stored = asVersion(localStorage.getItem(VERSION_KEY))
      if (stored) version.value = stored
    } catch {
      /* storage unavailable */
    }
  })
  return {
    outcome,
    modelState,
    version,
    showStatuses,
    groupVersions
  }
}
