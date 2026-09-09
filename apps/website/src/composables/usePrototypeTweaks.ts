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

// What the visitor finds when Stripe sends them back. On this rail completion
// arrives by webhook, so "settling" and "never arrives" are indistinguishable to
// the page — the difference is only how long it has been.
export const TOP_UP_OUTCOMES = ['landed', 'settling', 'unresolved'] as const
export type TopUpOutcome = (typeof TOP_UP_OUTCOMES)[number]

// Which part of the buy-credits flow a link opens on. The states after the
// hand-off are the point of the flow and cost three clicks to reach, so they
// are addressable directly for review.
export const BUY_STEPS = [
  'closed',
  'amount',
  'waiting',
  'landed',
  'unresolved'
] as const
export type BuyStep = (typeof BUY_STEPS)[number]

// Which rail the buy actions use. 'in-place' is the designed flow (DES-1013):
// our dialog, then hosted checkout, then the outcome states. 'platform' is the
// MVP that ships first (DES-1015): every buy action is a plain link out to
// platform.comfy.org, and this page's only job on return is to re-read the
// balance. The two share a gate and nothing else.
export const TOP_UP_RAILS = ['in-place', 'platform'] as const
export type TopUpRail = (typeof TOP_UP_RAILS)[number]

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
// The catalogue lists one card per model, as the TDD describes. Grouping the
// releases of a family behind the newest is an unsettled variant.
const groupVersions = ref(false)
const topUpOutcome = ref<TopUpOutcome>('landed')
const buyStep = ref<BuyStep>('closed')
const topUpRail = ref<TopUpRail>('in-place')
let hydrated = false

function isVersion(value: unknown): value is Version {
  return (
    typeof value === 'string' && (VERSIONS as readonly string[]).includes(value)
  )
}

function isTopUpRail(value: unknown): value is TopUpRail {
  return (
    typeof value === 'string' &&
    (TOP_UP_RAILS as readonly string[]).includes(value)
  )
}

function isBuyStep(value: unknown): value is BuyStep {
  return (
    typeof value === 'string' &&
    (BUY_STEPS as readonly string[]).includes(value)
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
    // Read straight from the query rather than through the share codec, which
    // imports this module. Hydrating here rather than in the tweaks panel keeps
    // it independent of which island mounts first, and means the dialog can
    // consume it without the panel putting it back.
    const query = new URLSearchParams(location.search)
    const entry = query.get('buy')
    if (isBuyStep(entry)) buyStep.value = entry
    const rail = query.get('rail')
    if (isTopUpRail(rail)) topUpRail.value = rail
  })
  return {
    outcome,
    modelState,
    version,
    showStatuses,
    groupVersions,
    topUpOutcome,
    buyStep,
    topUpRail
  }
}
