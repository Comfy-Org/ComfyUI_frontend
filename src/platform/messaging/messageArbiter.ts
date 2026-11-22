/**
 * Pure decision core for pushed product messages (issue #22003).
 *
 * Given every message that wants the screen at one moment, it returns one
 * result per candidate and at most one pushed message for the single slot.
 * It reads no clock, storage or store: callers pass `now` and the exposure
 * state, so every policy case is a deterministic table test.
 *
 * Product rules come from the messaging playbook
 * (https://github.com/Comfy-Org/messaging-playbook). The playbook examples
 * are the source; the cases in `messageArbiter.test.ts` are the oracle.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Minimum gap between two shown messages of one class. */
const COOLDOWN_MS: Partial<Record<MessageClass, number>> = {
  research: 30 * DAY_MS,
  promotion: 30 * DAY_MS
}

/** Research and promotion wait this long after sign-up. */
const EARLY_USER_MS = 7 * DAY_MS
/** In its last days before the end date a message moves up. */
const DEADLINE_BOOST_MS = 3 * DAY_MS
/** After this many showings with no action, a message is done. */
const MAX_SHOWINGS = 3

type MessageClass =
  | 'critical'
  | 'onboarding'
  | 'recommended_update'
  | 'announcement'
  | 'research'
  | 'promotion'

/** Lower wins. A deadline or PM boost ranks just below onboarding. */
const CLASS_RANK: Record<MessageClass, number> = {
  critical: 0,
  onboarding: 1,
  recommended_update: 3,
  announcement: 4,
  research: 5,
  promotion: 6
}
const BOOSTED_RANK = 2

/**
 * `pushed`: the product asks for the screen and uses the budget.
 * `user_started`: the user opened it; it never uses the budget.
 * `follow_up`: the user asked for it from another message; no budget.
 */
type MessageSource = 'pushed' | 'user_started' | 'follow_up'

type MessageForm = 'dialog' | 'card' | 'tour' | 'banner'

export interface MessageEnvelope {
  /** Stable identity. A text edit keeps it and bumps `version`. */
  id: string
  version: number
  class: MessageClass
  source: MessageSource
  form: MessageForm
  owner?: string
  startsAt?: number
  endsAt?: number
  /** The kill switch, already resolved for this client. */
  switchedOff: boolean
  /** The audience check, already resolved for this user. */
  forUser: boolean
  /** An older message this one replaces; the old one is withdrawn. */
  replaces?: string
  /** A PM move-up, which always carries its own end. */
  boostedUntil?: number
  /** Beta or nightly feedback that may use the tester allowance. */
  testerFeedback?: boolean
}

export interface MessageExposure {
  /** Done for good: dismissed, answered, actioned or shown out. */
  done: boolean
  showings: number
  snoozedUntil?: number
  /** A critical message closed this session; it returns next session. */
  closedThisSession?: boolean
}

type Moment = 'session_start' | 'working' | 'break' | 'hidden'

export interface ArbiterInput {
  now: number
  moment: Moment
  user: {
    /** First session of a new user: onboarding only. */
    firstSession: boolean
    signedUpAt?: number
    tester: boolean
  }
  /** Things on screen that are not pushed messages. */
  screen: {
    dialogOpen: boolean
    unresolvedError: boolean
    /** An onboarding tour or feature onboarding is running. */
    onboardingRunning: boolean
  }
  budget: {
    pushedToday: boolean
    testerPushToday: boolean
    /** An account message already asked the user to pay today. */
    payAskToday: boolean
  }
  /** When a message of each class last showed. */
  lastShownAt: Partial<Record<MessageClass, number>>
  exposure: Readonly<Partial<Record<string, MessageExposure>>>
  candidates: readonly MessageEnvelope[]
}

type ArbiterResult = 'show' | 'defer' | 'displace' | 'suppress'

type ArbiterReason =
  | 'missing_record'
  | 'not_for_user'
  | 'ended'
  | 'dismissed'
  | 'shown_out'
  | 'turned_off'
  | 'replaced'
  | 'budget_used'
  | 'too_early'
  | 'snoozed'
  | 'cooldown'
  | 'not_quiet'
  | 'after_error'
  | 'in_onboarding'
  | 'lower_priority'
  | 'user_started'
  | 'next_session'
  | 'highest_priority'
  | 'no_budget_needed'

export interface ArbiterOutcome {
  result: ArbiterResult
  reason: ArbiterReason
}

export interface ArbiterDecision {
  outcomes: Record<string, ArbiterOutcome>
  /** The one pushed message that gets the slot, if any. */
  pushedSlot: string | null
}

const suppress = (reason: ArbiterReason): ArbiterOutcome => ({
  result: 'suppress',
  reason
})
const defer = (reason: ArbiterReason): ArbiterOutcome => ({
  result: 'defer',
  reason
})

const usesBudget = (m: MessageEnvelope) =>
  m.source === 'pushed' &&
  m.class !== 'critical' &&
  m.class !== 'onboarding' &&
  m.class !== 'recommended_update'

interface GateContext {
  input: ArbiterInput
  seen: MessageExposure | undefined
  replacedIds: ReadonlySet<string>
}

/** One check: the outcome when `when` holds. First match wins. */
interface Rule {
  when: (m: MessageEnvelope, c: GateContext) => boolean
  outcome: ArbiterOutcome
}

const isPushed = (m: MessageEnvelope) => m.source === 'pushed'
const before = (now: number, at: number | undefined) =>
  at !== undefined && now < at
const isEarlyUser = ({ user, now }: ArbiterInput) =>
  user.firstSession ||
  (user.signedUpAt !== undefined && now - user.signedUpAt < EARLY_USER_MS)
const inCooldown = (m: MessageEnvelope, { lastShownAt, now }: ArbiterInput) => {
  const cooldown = COOLDOWN_MS[m.class]
  const last = lastShownAt[m.class]
  return cooldown !== undefined && last !== undefined && now - last < cooldown
}

/** Checks on the message record and its exposure, for every source. */
const RECORD_RULES: Rule[] = [
  {
    when: (m) => isPushed(m) && (!m.owner || m.endsAt === undefined),
    outcome: suppress('missing_record')
  },
  { when: (m) => m.switchedOff, outcome: suppress('turned_off') },
  {
    when: (m, c) => m.endsAt !== undefined && c.input.now >= m.endsAt,
    outcome: suppress('ended')
  },
  { when: (m) => !m.forUser, outcome: suppress('not_for_user') },
  { when: (m, c) => c.replacedIds.has(m.id), outcome: suppress('replaced') },
  { when: (_, c) => c.seen?.done === true, outcome: suppress('dismissed') },
  {
    when: (m, c) =>
      isPushed(m) &&
      m.class !== 'critical' &&
      (c.seen?.showings ?? 0) >= MAX_SHOWINGS,
    outcome: suppress('shown_out')
  },
  {
    when: (m, c) =>
      m.class === 'critical' && c.seen?.closedThisSession === true,
    outcome: defer('next_session')
  },
  {
    when: (m, c) => before(c.input.now, m.startsAt),
    outcome: defer('too_early')
  },
  {
    when: (_, c) => before(c.input.now, c.seen?.snoozedUntil),
    outcome: defer('snoozed')
  }
]

/** Checks on the user and history, for pushed messages only. */
const PUSHED_RULES: Rule[] = [
  {
    when: (m, c) => c.input.user.firstSession && m.class === 'announcement',
    outcome: suppress('not_for_user')
  },
  {
    when: (m, c) =>
      (m.class === 'research' || m.class === 'promotion') &&
      isEarlyUser(c.input),
    outcome: defer('too_early')
  },
  { when: (m, c) => inCooldown(m, c.input), outcome: defer('cooldown') },
  {
    when: (m, c) => m.class === 'promotion' && c.input.budget.payAskToday,
    outcome: defer('budget_used')
  }
]

/** Holds that come from the moment and what is on screen. */
const MOMENT_RULES: Rule[] = [
  {
    when: (_, { input }) =>
      input.moment === 'hidden' ||
      input.moment === 'working' ||
      input.screen.dialogOpen,
    outcome: defer('not_quiet')
  },
  {
    when: (m, c) => c.input.screen.unresolvedError && m.class !== 'critical',
    outcome: defer('after_error')
  },
  {
    when: (m, c) =>
      c.input.screen.onboardingRunning && m.class !== 'onboarding',
    outcome: defer('in_onboarding')
  },
  // Outside session start only a card (or a banner) can show.
  {
    when: (m, c) =>
      c.input.moment !== 'session_start' &&
      (m.form === 'dialog' || m.form === 'tour'),
    outcome: defer('not_quiet')
  },
  { when: (m, c) => budgetHold(m, c.input), outcome: defer('budget_used') }
]

function firstMatch(
  rules: readonly Rule[],
  m: MessageEnvelope,
  c: GateContext
): ArbiterOutcome | null {
  return rules.find((r) => r.when(m, c))?.outcome ?? null
}

function gate(m: MessageEnvelope, c: GateContext): ArbiterOutcome | null {
  return (
    firstMatch(RECORD_RULES, m, c) ??
    (isPushed(m) ? firstMatch(PUSHED_RULES, m, c) : null)
  )
}

function budgetHold(m: MessageEnvelope, input: ArbiterInput): boolean {
  if (!usesBudget(m) || !input.budget.pushedToday) return false
  const testerAllowance =
    input.user.tester && m.testerFeedback && !input.budget.testerPushToday
  return !testerAllowance
}

function rank(m: MessageEnvelope, now: number): number {
  const base = CLASS_RANK[m.class]
  const boosted =
    before(now, m.boostedUntil) ||
    (m.endsAt !== undefined && m.endsAt - now <= DEADLINE_BOOST_MS)
  return boosted ? Math.min(base, BOOSTED_RANK) : base
}

/** Gives the slot to the highest-ranked pushed message the moment allows. */
function pickPushed(
  pushed: MessageEnvelope[],
  c: GateContext,
  outcomes: Record<string, ArbiterOutcome>
): MessageEnvelope | null {
  const { now } = c.input
  const ordered = [...pushed].sort(
    (a, b) => rank(a, now) - rank(b, now) || a.id.localeCompare(b.id)
  )
  let winner: MessageEnvelope | null = null
  for (const m of ordered) {
    const held = firstMatch(MOMENT_RULES, m, { ...c, seen: undefined })
    if (held) outcomes[m.id] = held
    else if (winner) outcomes[m.id] = defer('lower_priority')
    else {
      winner = m
      outcomes[m.id] = { result: 'show', reason: 'highest_priority' }
    }
  }
  return winner
}

function startedOutcome(
  m: MessageEnvelope,
  input: ArbiterInput,
  winner: MessageEnvelope | null
): ArbiterOutcome {
  if (input.moment === 'hidden' || input.screen.dialogOpen)
    return defer('not_quiet')
  const onboarding =
    input.screen.onboardingRunning || winner?.class === 'onboarding'
  if (m.source === 'user_started' && onboarding) return defer('in_onboarding')
  return { result: 'show', reason: 'no_budget_needed' }
}

/**
 * The user started something, so a pushed card closes. It is not done; it
 * comes back. A session-start dialog covers the screen and stays until the
 * user closes it, and a critical message is never closed for a user action.
 */
const closesFor = (m: MessageEnvelope, winner: MessageEnvelope) =>
  m.source === 'user_started' &&
  winner.form !== 'dialog' &&
  winner.class !== 'critical'

/** Decides every candidate for one moment. Pure and deterministic. */
export function decideMessages(input: ArbiterInput): ArbiterDecision {
  const outcomes: Record<string, ArbiterOutcome> = {}
  const replacedIds = new Set(
    input.candidates.flatMap((m) =>
      m.replaces !== undefined && m.forUser && !m.switchedOff
        ? [m.replaces]
        : []
    )
  )

  const pushed: MessageEnvelope[] = []
  const started: MessageEnvelope[] = []
  for (const m of input.candidates) {
    const c = { input, seen: input.exposure[m.id], replacedIds }
    const blocked = gate(m, c)
    if (blocked) outcomes[m.id] = blocked
    else (isPushed(m) ? pushed : started).push(m)
  }

  let winner = pickPushed(
    pushed,
    { input, seen: undefined, replacedIds },
    outcomes
  )
  for (const m of started) {
    const outcome = startedOutcome(m, input, winner)
    outcomes[m.id] = outcome
    if (outcome.result === 'show' && winner && closesFor(m, winner)) {
      outcomes[winner.id] = { result: 'displace', reason: 'user_started' }
      winner = null
    }
  }

  return { outcomes, pushedSlot: winner?.id ?? null }
}

/**
 * Merges install state into account state at sign-in. The stricter value
 * wins: done stays done, showings never go down, the later snooze holds.
 */
export function mergeExposure(
  account: MessageExposure | undefined,
  install: MessageExposure | undefined
): MessageExposure {
  const a = account ?? { done: false, showings: 0 }
  const b = install ?? { done: false, showings: 0 }
  const snoozes = [a.snoozedUntil, b.snoozedUntil].filter(
    (v): v is number => v !== undefined
  )
  return {
    done: a.done || b.done,
    showings: Math.max(a.showings, b.showings),
    ...(snoozes.length ? { snoozedUntil: Math.max(...snoozes) } : {}),
    ...(a.closedThisSession || b.closedThisSession
      ? { closedThisSession: true }
      : {})
  }
}
