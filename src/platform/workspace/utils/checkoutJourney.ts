import type { ServerFeatureFlag } from '@/composables/useFeatureFlags'
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
// Typed to the enum member's value so a future correction of the flag key (or
// its `checked`/`checkout` typo) fails to compile here instead of silently
// reading a stale key. Type-only, so consumers' test mocks need no runtime enum.
const EMBEDDED_CHECKOUT_FLAG_KEY: `${ServerFeatureFlag.EMBEDDED_CHECKOUT_ENABLED}` =
  'embedded_checked_enabled'

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
  /**
   * Stable key for the intended purchase within the flow (e.g. tier:cycle).
   * A change of intent starts a new journey rather than resuming.
   */
  intent?: string
  assignment_status: CheckoutAssignmentStatus
  assigned_arm?: CheckoutJourneyArm
  ui_mode?: CheckoutUiMode
  billing_op_id?: string
}

export type CheckoutAssignment =
  | { status: 'resolved'; arm: CheckoutJourneyArm }
  | { status: 'unavailable' }

interface CheckoutJourneyIdentity {
  actorUid: string
  workspaceId: string
}

export interface StartCheckoutJourneyInput extends CheckoutJourneyIdentity {
  entryFlow: CheckoutEntryFlow
  entrySource: CheckoutEntrySource
  assignment: CheckoutAssignment
  /** Stable key for the intended purchase (e.g. tier:cycle); a change starts a new journey. */
  intent?: string
  /** Checkout UI the user actually sees, so a frozen arm can be reconciled against real experience. */
  uiMode?: CheckoutUiMode
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
    ...(input.intent !== undefined && { intent: input.intent }),
    assignment_status: input.assignment.status,
    ...(input.assignment.status === 'resolved' && {
      assigned_arm: input.assignment.arm
    }),
    ...(input.uiMode !== undefined && { ui_mode: input.uiMode })
  }
}

export function toCheckoutJourneyContext(
  record: CheckoutJourneyRecord
): CheckoutJourneyContext {
  const base = {
    checkout_journey_id: record.journey_id,
    checkout_entered_at: record.entered_at,
    entry_flow: record.entry_flow,
    entry_source: record.entry_source,
    ...(record.ui_mode !== undefined && { ui_mode: record.ui_mode }),
    ...(record.billing_op_id !== undefined && {
      billing_op_id: record.billing_op_id
    })
  }

  return record.assignment_status === 'resolved' &&
    record.assigned_arm !== undefined
    ? {
        ...base,
        assignment_status: 'resolved',
        assigned_arm: record.assigned_arm
      }
    : { ...base, assignment_status: 'unavailable' }
}

function isCheckoutJourneyExpired(
  record: CheckoutJourneyRecord,
  now: number
): boolean {
  return now - record.started_at_ms > CHECKOUT_JOURNEY_MAX_AGE_MS
}

function journeyMatchesIdentity(
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
    existing.entry_flow === input.entryFlow &&
    existing.intent === input.intent
  ) {
    return { record: existing, resumed: true }
  }

  // A different rail's operation is in flight and still owns the single journey
  // slot — its poller gates the terminal clear on this record's billing_op_id.
  // A single storage slot can't isolate two concurrent rails, so the bound
  // journey takes precedence until it resolves. See ADR-BILLING-CHECKOUT-0031.
  if (
    existing &&
    !isCheckoutJourneyExpired(existing, now) &&
    existing.billing_op_id !== undefined &&
    existing.entry_flow !== input.entryFlow
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

  // A journey binds to exactly one operation. If it is already bound (e.g. a
  // concurrent rail's operation is in flight), refuse to rebind so the first
  // operation keeps ownership of the terminal clear.
  if (existing.billing_op_id !== undefined) {
    return existing.billing_op_id === billingOpId ? existing : null
  }

  const updated: CheckoutJourneyRecord = {
    ...existing,
    billing_op_id: billingOpId
  }
  saveCheckoutJourney(updated)
  return updated
}

export function clearCheckoutJourney(): void {
  inMemoryJourney = null
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

let fallbackJourneyIdCounter = 0

function createJourneyId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  // Monotonic suffix so journeys created within the same millisecond stay
  // distinct when randomUUID is unavailable.
  fallbackJourneyIdCounter += 1
  return `journey-${Date.now()}-${fallbackJourneyIdCounter}`
}

/**
 * Session-scoped mirror so the journey stays consistent even when
 * `sessionStorage` is unavailable (private mode, quota, disabled). Reload
 * resilience still requires storage, but within a session the active journey
 * never silently vanishes and `entered` is not re-emitted.
 */
let inMemoryJourney: CheckoutJourneyRecord | null = null

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
  inMemoryJourney = record
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
  // The mirror is the source of truth within a session: it holds the latest
  // write even when persistence failed, so a stale persisted record can never
  // shadow it. Persisted storage is only consulted to rehydrate after reload.
  const record = inMemoryJourney ?? readPersistedJourney()
  if (!record) {
    return null
  }

  if (isCheckoutJourneyExpired(record, Date.now())) {
    clearCheckoutJourney()
    return null
  }

  inMemoryJourney = record
  return record
}

function readPersistedJourney(): CheckoutJourneyRecord | null {
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

  const arm = candidate.assigned_arm
  const hasValidArm = arm === 'control' || arm === 'treatment'
  // Enforce the assignment invariant on persisted records: resolved must carry
  // an arm, unavailable must not. A contradictory record is discarded rather
  // than replayed as a fabricated assignment.
  if (candidate.assignment_status === 'resolved' && !hasValidArm) {
    return null
  }
  if (candidate.assignment_status === 'unavailable' && arm !== undefined) {
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
    ...(typeof candidate.intent === 'string' && { intent: candidate.intent }),
    assignment_status: candidate.assignment_status,
    ...(hasValidArm ? { assigned_arm: arm } : {}),
    ...(candidate.ui_mode === 'embedded' ||
    candidate.ui_mode === 'hosted' ||
    candidate.ui_mode === 'unknown'
      ? { ui_mode: candidate.ui_mode }
      : {}),
    ...(typeof candidate.billing_op_id === 'string' && {
      billing_op_id: candidate.billing_op_id
    })
  }
}
