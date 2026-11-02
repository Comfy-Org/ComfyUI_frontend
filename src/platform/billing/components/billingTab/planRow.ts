import type {
  BillingCapabilitiesResponse,
  SubscriptionState
} from '@comfyorg/ingest-types'

import type {
  BillingStatus,
  BillingSubscriptionStatus,
  SubscriptionDuration
} from '@comfyorg/billing-core'

type BillingCadence = 'monthly' | 'yearly'

export interface PlanRowFacts {
  subscriptionStatus: BillingSubscriptionStatus | null
  subscriptionState: SubscriptionState | null
  billingStatus: BillingStatus | null
  duration: SubscriptionDuration | null
  planName: string | null
  renewalDate: string | null
  endDate: string | null
  endedAt?: string | null
  scheduledChange: { planName: string; effectiveAt: string } | null
  freeRuns: { remaining: number; total: number } | null
  planKind: PlanKind | null
}

export type PlanRowState =
  | { kind: 'activating'; planName: string }
  | { kind: 'paused'; planName: string }
  | {
      kind: 'active'
      planName: string
      cadence: BillingCadence
      nextInvoice: string
      scheduledChange: { planName: string; effectiveAt: string } | null
    }
  | {
      kind: 'ending'
      planName: string
      cadence: BillingCadence | null
      endsAt: string
    }
  | {
      kind: 'ended'
      planName: string | null
      cadence: BillingCadence | null
      endedAt: string | null
    }
  | {
      kind: 'noPlan'
      freeRuns: { remaining: number; total: number } | null
    }
  | {
      kind: 'salesManaged'
      planName: string | null
      cadence: BillingCadence | null
      renewsAt: string | null
    }
  | { kind: 'unknown' }

export type PlanRowAction =
  | 'manage'
  | 'subscribe'
  | 'choosePlan'
  | 'contactSales'

export type PlanKind = NonNullable<BillingCapabilitiesResponse['plan_kind']>

export const CONTACT_SALES_URL = 'https://comfy.org/contact/'

type BillingTabLoad = 'loading' | 'error' | 'ready'

const UNKNOWN: PlanRowState = { kind: 'unknown' }

function toCadence(
  duration: SubscriptionDuration | null
): BillingCadence | null {
  if (duration === 'MONTHLY') return 'monthly'
  if (duration === 'ANNUAL') return 'yearly'
  return null
}

function endedDate(facts: PlanRowFacts): string | null {
  return facts.endedAt === undefined ? facts.endDate : facts.endedAt
}

function endedRow(facts: PlanRowFacts): PlanRowState {
  return {
    kind: 'ended',
    planName: facts.planName,
    cadence: toCadence(facts.duration),
    endedAt: endedDate(facts)
  }
}

function salesManagedRow(facts: PlanRowFacts): PlanRowState | null {
  if (facts.planKind !== 'sales_managed') return null
  switch (facts.billingStatus) {
    case 'paused':
      return null
  }
  switch (facts.subscriptionStatus) {
    case 'active':
      return {
        kind: 'salesManaged',
        planName: facts.planName,
        cadence: toCadence(facts.duration),
        renewsAt: facts.renewalDate
      }
    default:
      return null
  }
}

/** Maps the served status fields onto the plan row; whatever they cannot render is `unknown`. */
export function derivePlanRow(facts: PlanRowFacts): PlanRowState {
  const { subscriptionStatus, planName, renewalDate, endDate } = facts
  if (facts.subscriptionState === 'activating' && planName !== null) {
    return { kind: 'activating', planName }
  }
  if (facts.subscriptionState === 'ended') {
    return endedRow(facts)
  }
  switch (subscriptionStatus) {
    case 'ended':
      return endedRow(facts)
  }
  if (subscriptionStatus === null) {
    return { kind: 'noPlan', freeRuns: facts.freeRuns }
  }
  const salesManaged = salesManagedRow(facts)
  if (salesManaged) return salesManaged
  if (planName === null) return UNKNOWN
  switch (facts.billingStatus) {
    case 'paused':
      return { kind: 'paused', planName }
  }

  const cadence = toCadence(facts.duration)
  switch (subscriptionStatus) {
    case 'active':
      if (!renewalDate || cadence === null) return UNKNOWN
      return {
        kind: 'active',
        planName,
        cadence,
        nextInvoice: renewalDate,
        scheduledChange: facts.scheduledChange
      }
    case 'canceled':
      return endDate
        ? { kind: 'ending', planName, cadence, endsAt: endDate }
        : UNKNOWN
    default:
      return UNKNOWN
  }
}

/** Self-serve actions follow `can_open_plans`. `sales_managed` is Contact sales. */
export function planRowAction(
  state: PlanRowState,
  {
    canOpenPlans,
    planKind
  }: { canOpenPlans: boolean; planKind: PlanKind | null }
): PlanRowAction | null {
  if (planKind === 'sales_managed') return 'contactSales'
  if (!canOpenPlans) return null
  switch (state.kind) {
    case 'activating':
    case 'active':
    case 'ending':
    case 'paused':
    case 'unknown':
      return 'manage'
    case 'noPlan':
      return 'subscribe'
    case 'ended':
      return 'choosePlan'
    case 'salesManaged':
      return null
  }
}

interface BillingTabLoadFacts {
  billingError: string | null
  billingInitialized: boolean
  capabilitiesReady: boolean
  capabilitiesResolved: boolean
}

export function deriveBillingTabLoad(
  facts: BillingTabLoadFacts
): BillingTabLoad {
  if (
    facts.billingError !== null ||
    (facts.capabilitiesReady && !facts.capabilitiesResolved)
  ) {
    return 'error'
  }
  return facts.billingInitialized && facts.capabilitiesReady
    ? 'ready'
    : 'loading'
}

/** Full month name, no ordinal; the year unless the plan is monthly. */
export function formatPlanDate(
  isoDate: string,
  locale: string,
  cadence: BillingCadence | null
): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
    ...(cadence === 'monthly' ? {} : { year: 'numeric' }),
    timeZone: 'UTC'
  }).format(date)
}
