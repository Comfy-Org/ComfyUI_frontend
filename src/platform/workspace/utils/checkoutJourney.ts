import type { ServerFeatureFlag } from '@/composables/useFeatureFlags'
import type {
  CheckoutAssignmentStatus,
  CheckoutEntryFlow,
  CheckoutEntrySource,
  CheckoutJourneyArm,
  CheckoutJourneyContext,
  CheckoutUiMode,
  PaymentIntentSource
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

// These three allowlists guard the persisted-record rehydration path, which is
// the *primary* path for hosted checkout: the user leaves the page for Stripe
// and the journey resumes from storage on return, so every post-redirect phase
// — including the `.succeeded` events revenue attribution reads — takes its
// entry context from here. A `ReadonlySet<T>` constrains element types only and
// does not require every union member, so a value added to one of these unions
// but forgotten here used to compile clean and then silently degrade to
// `'unknown'` at runtime. Written as `satisfies Record<T, true>` (the pattern
// `VALID_PAYMENT_INTENT_SOURCES` already uses) so the omission is a build error
// instead.
const ENTRY_FLOWS = {
  initial_subscription: true,
  paid_upgrade: true,
  topup: true,
  other: true,
  unknown: true
} satisfies Record<CheckoutEntryFlow, true>
const ENTRY_SOURCES = {
  pricing: true,
  deep_link: true,
  recovery: true,
  settings_billing: true,
  other: true,
  unknown: true,
  agent_paywall: true
} satisfies Record<CheckoutEntrySource, true>

const toEntryFlow = (value: unknown): CheckoutEntryFlow =>
  typeof value === 'string' && Object.hasOwn(ENTRY_FLOWS, value)
    ? (value as CheckoutEntryFlow)
    : 'unknown'

const toEntrySource = (value: unknown): CheckoutEntrySource =>
  typeof value === 'string' && Object.hasOwn(ENTRY_SOURCES, value)
    ? (value as CheckoutEntrySource)
    : 'unknown'

/**
 * Entry sources that a payment-intent source pins directly. Both checkout
 * rails already thread a `PaymentIntentSource` from the surface that opened
 * them, so the journey's entry source is derived from it rather than plumbed
 * separately. A source absent from this map keeps its rail's own default,
 * which is what holds every pre-existing surface's attribution byte-identical.
 */
const PAYMENT_INTENT_ENTRY_SOURCES: Partial<
  Record<PaymentIntentSource, CheckoutEntrySource>
> = {
  agent_paywall: 'agent_paywall'
}

/**
 * Entry source for a journey opened with `paymentIntentSource`.
 *
 * Guarded with `Object.hasOwn` like the three lookups above: an unvalidated
 * key would otherwise resolve inherited `Object.prototype` members truthy
 * (`'constructor'`, `'toString'`), so `?? fallback` would not fire and a
 * non-`CheckoutEntrySource` value would reach the record, storage and every
 * downstream phase.
 */
export const resolveEntrySource = (
  paymentIntentSource: PaymentIntentSource | undefined,
  fallback: CheckoutEntrySource
): CheckoutEntrySource =>
  paymentIntentSource !== undefined &&
  Object.hasOwn(PAYMENT_INTENT_ENTRY_SOURCES, paymentIntentSource)
    ? (PAYMENT_INTENT_ENTRY_SOURCES[paymentIntentSource] ?? fallback)
    : fallback

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

export type ResolveCheckoutJourneyResult =
  | {
      status: 'active'
      record: CheckoutJourneyRecord
      /** True when an in-flight journey was recovered rather than newly created. */
      resumed: boolean
    }
  /**
   * Another rail owns the single journey slot with an operation still in
   * flight. This rail gets no journey at all rather than a foreign one: its
   * phases would otherwise be emitted under the other rail's `entry_flow`.
   */
  | { status: 'blocked' }

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

  const live = existing && !isCheckoutJourneyExpired(existing, now)

  if (
    live &&
    journeyMatchesIdentity(existing, input) &&
    existing.entry_flow === input.entryFlow &&
    existing.intent === input.intent
  ) {
    return { status: 'active', record: existing, resumed: true }
  }

  // Control has reached here, so the live journey does not match this entry and
  // would be replaced. A journey bound to an in-flight operation must not be:
  // its poller gates the terminal clear on this record's billing_op_id, so
  // evicting it leaves the operation unable to close its own journey and the
  // replacement active indefinitely. A single storage slot cannot isolate two
  // journeys, so the bound one keeps it and this entry goes uninstrumented
  // until the operation resolves. See ADR-BILLING-CHECKOUT-0031.
  //
  // This covers a different rail *and* the same rail entered under a different
  // intent — a top-up reopened from another surface, or a tier changed
  // mid-operation. Both replace a bound journey, and neither is safe.
  if (live && existing.billing_op_id !== undefined) {
    return { status: 'blocked' }
  }

  const record = createCheckoutJourneyRecord(input, now)
  saveCheckoutJourney(record)
  return { status: 'active', record, resumed: false }
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
    persistedJourneyIsStale = false
  } catch {
    persistedJourneyIsStale = true
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

/**
 * Set when a write to persistent storage failed, leaving a record there that no
 * longer reflects this session. Rehydrating it would resurrect a journey the
 * session already cleared, so persisted reads are suppressed until a write
 * succeeds.
 */
let persistedJourneyIsStale = false

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
    persistedJourneyIsStale = false
  } catch {
    persistedJourneyIsStale = true
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
  if (persistedJourneyIsStale) {
    return null
  }

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

const UI_MODES = {
  embedded: true,
  hosted: true,
  unknown: true
} satisfies Record<CheckoutUiMode, true>

type PersistedJourneyIdentity = Pick<
  CheckoutJourneyRecord,
  'journey_id' | 'entered_at' | 'started_at_ms' | 'actor_uid' | 'workspace_id'
>

function readIdentity(
  candidate: Record<string, unknown>
): PersistedJourneyIdentity | null {
  const { journey_id, entered_at, started_at_ms, actor_uid, workspace_id } =
    candidate
  // A non-finite started_at_ms would make every expiry comparison false, so an
  // immortal journey could be persisted by hand; an unparseable entered_at
  // would reach telemetry as the journey's declared UTC entry time.
  return typeof journey_id === 'string' &&
    typeof entered_at === 'string' &&
    !Number.isNaN(Date.parse(entered_at)) &&
    typeof started_at_ms === 'number' &&
    Number.isFinite(started_at_ms) &&
    typeof actor_uid === 'string' &&
    typeof workspace_id === 'string'
    ? { journey_id, entered_at, started_at_ms, actor_uid, workspace_id }
    : null
}

type PersistedAssignment = Pick<
  CheckoutJourneyRecord,
  'assignment_status' | 'assigned_arm'
>

/**
 * Enforce the assignment invariant on persisted records: resolved must carry an
 * arm, unavailable must not. A contradictory record is rejected rather than
 * replayed as a fabricated assignment.
 */
function readAssignment(
  candidate: Record<string, unknown>
): PersistedAssignment | null {
  const status = candidate.assignment_status
  const arm = candidate.assigned_arm

  if (status === 'unavailable') {
    return arm === undefined ? { assignment_status: 'unavailable' } : null
  }
  if (status !== 'resolved') {
    return null
  }
  return arm === 'control' || arm === 'treatment'
    ? { assignment_status: 'resolved', assigned_arm: arm }
    : null
}

function readOptionalFields(candidate: Record<string, unknown>) {
  const { intent, ui_mode, billing_op_id } = candidate
  return {
    ...(typeof intent === 'string' && { intent }),
    ...(typeof ui_mode === 'string' &&
      Object.hasOwn(UI_MODES, ui_mode) && {
        ui_mode: ui_mode as CheckoutUiMode
      }),
    ...(typeof billing_op_id === 'string' && { billing_op_id })
  }
}

function normalizeRecord(value: unknown): CheckoutJourneyRecord | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Record<string, unknown>
  const identity = readIdentity(candidate)
  const assignment = readAssignment(candidate)
  if (!identity || !assignment) {
    return null
  }

  return {
    ...identity,
    entry_flow: toEntryFlow(candidate.entry_flow),
    entry_source: toEntrySource(candidate.entry_source),
    ...assignment,
    ...readOptionalFields(candidate)
  }
}
