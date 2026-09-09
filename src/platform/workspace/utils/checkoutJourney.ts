import type {
  CheckoutAssignmentStatus,
  CheckoutEntryFlow,
  CheckoutEntrySource,
  CheckoutJourneyArm,
  CheckoutJourneyContext,
  CheckoutUiMode
} from '@/platform/telemetry/types'

/**
 * One lifecycle owner for a checkout journey's frozen entry context and
 * durable resume metadata, shared by the subscription and top-up rails and
 * by both rollout arms. The journey identity and its server-assigned arm are
 * captured once at entry and preserved across reload; a later flag refresh
 * changes observed behaviour but never the frozen assignment. See
 * ADR-AUTH-BILLING-0014 for the rail-neutral attempt context this extends.
 */

const CHECKOUT_JOURNEY_MAX_AGE_MS = 24 * 60 * 60 * 1000
const CHECKOUT_JOURNEY_STORAGE_KEY = 'comfy.checkout.journey'
const EMBEDDED_CHECKOUT_FLAG_KEY = 'embedded_checked_enabled'

const ENTRY_FLOWS: ReadonlySet<CheckoutEntryFlow> = new Set([
  'initial_subscription',
  'paid_upgrade',
  'topup',
  'other',
  'unknown'
])
const ENTRY_SOURCES: ReadonlySet<CheckoutEntrySource> = new Set([
  'pricing',
  'deep_link',
  'recovery',
  'settings_billing',
  'other',
  'unknown'
])

const toEntryFlow = (value: unknown): CheckoutEntryFlow =>
  ENTRY_FLOWS.has(value as CheckoutEntryFlow)
    ? (value as CheckoutEntryFlow)
    : 'unknown'

const toEntrySource = (value: unknown): CheckoutEntrySource =>
  ENTRY_SOURCES.has(value as CheckoutEntrySource)
    ? (value as CheckoutEntrySource)
    : 'unknown'

export interface CheckoutJourneyRecord {
  journey_id: string
  entered_at: string
  started_at_ms: number
  actor_uid: string
  workspace_id: string
  entry_flow: CheckoutEntryFlow
  entry_source: CheckoutEntrySource
  assignment_status: CheckoutAssignmentStatus
  assigned_arm?: CheckoutJourneyArm
  ui_mode?: CheckoutUiMode
  checkout_attempt_id?: string
  billing_op_id?: string
}

export type CheckoutAssignment =
  | { status: 'resolved'; arm: CheckoutJourneyArm }
  | { status: 'unavailable' }

export interface CheckoutJourneyIdentity {
  actorUid: string
  workspaceId: string
}

export interface StartCheckoutJourneyInput extends CheckoutJourneyIdentity {
  entryFlow: CheckoutEntryFlow
  entrySource: CheckoutEntrySource
  assignment: CheckoutAssignment
  checkoutAttemptId?: string
}

export interface ResolveCheckoutJourneyResult {
  record: CheckoutJourneyRecord
  /** True when an in-flight journey was recovered rather than newly created. */
  resumed: boolean
}

/**
 * Freeze the rollout arm from the server feature response used at entry. An
 * absent flag is `unavailable`, never a fabricated `control`, so an unknown
 * assignment cannot masquerade as a resolved control arm downstream.
 */
export function resolveCheckoutAssignment(
  serverFeatures: Record<string, unknown>
): CheckoutAssignment {
  if (!Object.hasOwn(serverFeatures, EMBEDDED_CHECKOUT_FLAG_KEY)) {
    return { status: 'unavailable' }
  }

  return {
    status: 'resolved',
    arm:
      serverFeatures[EMBEDDED_CHECKOUT_FLAG_KEY] === true
        ? 'treatment'
        : 'control'
  }
}

export function createCheckoutJourneyRecord(
  input: StartCheckoutJourneyInput,
  now: number
): CheckoutJourneyRecord {
  return {
    journey_id: createJourneyId(),
    entered_at: new Date(now).toISOString(),
    started_at_ms: now,
    actor_uid: input.actorUid,
    workspace_id: input.workspaceId,
    entry_flow: input.entryFlow,
    entry_source: input.entrySource,
    assignment_status: input.assignment.status,
    ...(input.assignment.status === 'resolved' && {
      assigned_arm: input.assignment.arm
    }),
    ...(input.checkoutAttemptId !== undefined && {
      checkout_attempt_id: input.checkoutAttemptId
    })
  }
}

export function toCheckoutJourneyContext(
  record: CheckoutJourneyRecord
): CheckoutJourneyContext {
  return {
    checkout_journey_id: record.journey_id,
    checkout_entered_at: record.entered_at,
    assignment_status: record.assignment_status,
    entry_flow: record.entry_flow,
    entry_source: record.entry_source,
    ...(record.assigned_arm !== undefined && {
      assigned_arm: record.assigned_arm
    }),
    ...(record.ui_mode !== undefined && { ui_mode: record.ui_mode }),
    ...(record.checkout_attempt_id !== undefined && {
      checkout_attempt_id: record.checkout_attempt_id
    }),
    ...(record.billing_op_id !== undefined && {
      billing_op_id: record.billing_op_id
    })
  }
}

export function isCheckoutJourneyExpired(
  record: CheckoutJourneyRecord,
  now: number
): boolean {
  return now - record.started_at_ms > CHECKOUT_JOURNEY_MAX_AGE_MS
}

export function journeyMatchesIdentity(
  record: CheckoutJourneyRecord,
  identity: CheckoutJourneyIdentity
): boolean {
  return (
    record.actor_uid === identity.actorUid &&
    record.workspace_id === identity.workspaceId
  )
}

/**
 * Recover an in-flight journey for the same actor, workspace, and purchase
 * intent, or begin a new one. A changed actor/workspace or a different entry
 * flow never inherits the previous context: the stale record is discarded and
 * a fresh journey created.
 */
export function resolveCheckoutJourney(
  input: StartCheckoutJourneyInput
): ResolveCheckoutJourneyResult {
  const now = Date.now()
  const existing = loadCheckoutJourney()

  if (
    existing &&
    !isCheckoutJourneyExpired(existing, now) &&
    journeyMatchesIdentity(existing, input) &&
    existing.entry_flow === input.entryFlow
  ) {
    return { record: existing, resumed: true }
  }

  const record = createCheckoutJourneyRecord(input, now)
  saveCheckoutJourney(record)
  return { record, resumed: false }
}

export function getActiveCheckoutJourney(): CheckoutJourneyRecord | null {
  return loadCheckoutJourney()
}

export function bindOperationToCheckoutJourney(
  billingOpId: string
): CheckoutJourneyRecord | null {
  const existing = loadCheckoutJourney()
  if (!existing) {
    return null
  }

  const updated: CheckoutJourneyRecord = {
    ...existing,
    billing_op_id: billingOpId
  }
  saveCheckoutJourney(updated)
  return updated
}

export function clearCheckoutJourney(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(CHECKOUT_JOURNEY_STORAGE_KEY)
  } catch {
    return
  }
}

function createJourneyId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `journey-${Date.now()}`
}

type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getStorage(): CheckoutStorage | null {
  let storage: unknown

  try {
    storage = globalThis.sessionStorage
  } catch {
    return null
  }

  return isCheckoutStorage(storage) ? storage : null
}

function isCheckoutStorage(value: unknown): value is CheckoutStorage {
  return (
    !!value &&
    typeof value === 'object' &&
    'getItem' in value &&
    typeof value.getItem === 'function' &&
    'setItem' in value &&
    typeof value.setItem === 'function' &&
    'removeItem' in value &&
    typeof value.removeItem === 'function'
  )
}

function saveCheckoutJourney(record: CheckoutJourneyRecord): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(CHECKOUT_JOURNEY_STORAGE_KEY, JSON.stringify(record))
  } catch {
    return
  }
}

function loadCheckoutJourney(): CheckoutJourneyRecord | null {
  const storage = getStorage()
  if (!storage) {
    return null
  }

  let raw: string | null
  try {
    raw = storage.getItem(CHECKOUT_JOURNEY_STORAGE_KEY)
  } catch {
    return null
  }

  if (!raw) {
    return null
  }

  try {
    const record = normalizeRecord(JSON.parse(raw))
    if (!record) {
      clearCheckoutJourney()
      return null
    }
    return record
  } catch {
    clearCheckoutJourney()
    return null
  }
}

function normalizeRecord(value: unknown): CheckoutJourneyRecord | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.journey_id !== 'string' ||
    typeof candidate.entered_at !== 'string' ||
    typeof candidate.started_at_ms !== 'number' ||
    typeof candidate.actor_uid !== 'string' ||
    typeof candidate.workspace_id !== 'string' ||
    (candidate.assignment_status !== 'resolved' &&
      candidate.assignment_status !== 'unavailable')
  ) {
    return null
  }

  return {
    journey_id: candidate.journey_id,
    entered_at: candidate.entered_at,
    started_at_ms: candidate.started_at_ms,
    actor_uid: candidate.actor_uid,
    workspace_id: candidate.workspace_id,
    entry_flow: toEntryFlow(candidate.entry_flow),
    entry_source: toEntrySource(candidate.entry_source),
    assignment_status: candidate.assignment_status,
    ...(candidate.assigned_arm === 'control' ||
    candidate.assigned_arm === 'treatment'
      ? { assigned_arm: candidate.assigned_arm }
      : {}),
    ...(candidate.ui_mode === 'embedded' ||
    candidate.ui_mode === 'hosted' ||
    candidate.ui_mode === 'unknown'
      ? { ui_mode: candidate.ui_mode }
      : {}),
    ...(typeof candidate.checkout_attempt_id === 'string' && {
      checkout_attempt_id: candidate.checkout_attempt_id
    }),
    ...(typeof candidate.billing_op_id === 'string' && {
      billing_op_id: candidate.billing_op_id
    })
  }
}
