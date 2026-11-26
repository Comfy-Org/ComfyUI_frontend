import { describe, expect, it } from 'vitest'

import { decideMessages, mergeExposure } from './messageArbiter'
import type {
  ArbiterInput,
  ArbiterOutcome,
  MessageEnvelope,
  MessageExposure
} from './messageArbiter'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 22, 12)

function message(
  id: string,
  overrides: Partial<MessageEnvelope> = {}
): MessageEnvelope {
  return {
    id,
    version: 1,
    class: 'announcement',
    source: 'pushed',
    form: 'card',
    owner: 'pm',
    endsAt: NOW + 30 * DAY,
    switchedOff: false,
    forUser: true,
    ...overrides
  }
}

const M = {
  tour: message('ftux-tour', { class: 'onboarding', form: 'tour' }),
  major: message('release-2.0-dialog', {
    form: 'dialog',
    replaces: 'whatsnew-v1.30'
  }),
  whatsnew: message('whatsnew-v1.30'),
  whatsnewAfter: message('whatsnew-after-update', { source: 'follow_up' }),
  agent: message('agent-onboarding', {
    class: 'onboarding',
    source: 'user_started',
    endsAt: undefined
  }),
  nps: message('nps', { class: 'research' }),
  promo: message('comfy-pro-promo', { class: 'promotion' })
}

type Setup = Partial<Omit<ArbiterInput, 'user' | 'screen' | 'budget'>> & {
  user?: Partial<ArbiterInput['user']>
  screen?: Partial<ArbiterInput['screen']>
  budget?: Partial<ArbiterInput['budget']>
}

function input(setup: Setup): ArbiterInput {
  return {
    now: NOW,
    moment: 'session_start',
    lastShownAt: {},
    exposure: {},
    candidates: [],
    ...setup,
    user: {
      firstSession: false,
      signedUpAt: NOW - 90 * DAY,
      tester: false,
      ...setup.user
    },
    screen: {
      dialogOpen: false,
      unresolvedError: false,
      onboardingRunning: false,
      ...setup.screen
    },
    budget: {
      pushedToday: false,
      testerPushToday: false,
      payAskToday: false,
      ...setup.budget
    }
  }
}

interface PolicyCase {
  id: string
  setup: Setup
  expect: Record<string, ArbiterOutcome['result']>
  slot: string | null
}

const PLAYBOOK_CASES: PolicyCase[] = [
  {
    id: 'new-user-first-session',
    setup: {
      user: { firstSession: true, signedUpAt: NOW },
      candidates: [M.tour, M.whatsnew, M.nps]
    },
    expect: { 'ftux-tour': 'show', 'whatsnew-v1.30': 'suppress', nps: 'defer' },
    slot: 'ftux-tour'
  },
  {
    id: 'survey-this-morning',
    setup: {
      lastShownAt: { research: NOW - DAY },
      candidates: [M.whatsnew, M.nps]
    },
    expect: { 'whatsnew-v1.30': 'show', nps: 'defer' },
    slot: 'whatsnew-v1.30'
  },
  {
    id: 'update-followup',
    setup: { budget: { pushedToday: true }, candidates: [M.whatsnewAfter] },
    expect: { 'whatsnew-after-update': 'show' },
    slot: null
  },
  {
    id: 'update-followup-dialog',
    setup: {
      budget: { pushedToday: true },
      screen: { dialogOpen: true },
      candidates: [M.whatsnewAfter]
    },
    expect: { 'whatsnew-after-update': 'defer' },
    slot: null
  },
  {
    id: 'user-working',
    setup: { moment: 'working', candidates: [M.whatsnew, M.nps] },
    expect: { 'whatsnew-v1.30': 'defer', nps: 'defer' },
    slot: null
  },
  {
    id: 'run-fails',
    setup: {
      moment: 'break',
      screen: { unresolvedError: true },
      candidates: [M.nps]
    },
    expect: { nps: 'defer' },
    slot: null
  },
  {
    id: 'out-of-credits-promo',
    setup: { budget: { payAskToday: true }, candidates: [M.promo] },
    expect: { 'comfy-pro-promo': 'defer' },
    slot: null
  },
  {
    id: 'new-user-clicks-agent',
    setup: {
      user: { firstSession: true, signedUpAt: NOW },
      candidates: [M.tour, M.agent]
    },
    expect: { 'ftux-tour': 'show', 'agent-onboarding': 'defer' },
    slot: 'ftux-tour'
  },
  {
    id: 'day-2-opens-agent',
    setup: {
      user: { signedUpAt: NOW - DAY },
      candidates: [M.whatsnew, M.nps, M.agent]
    },
    expect: {
      'whatsnew-v1.30': 'displace',
      nps: 'defer',
      'agent-onboarding': 'show'
    },
    slot: null
  },
  {
    id: 'card-and-nps',
    setup: { candidates: [M.whatsnew, M.nps] },
    expect: { 'whatsnew-v1.30': 'show', nps: 'defer' },
    slot: 'whatsnew-v1.30'
  },
  {
    id: 'major-release-day',
    setup: { candidates: [M.major, M.whatsnew, M.nps] },
    expect: {
      'release-2.0-dialog': 'show',
      'whatsnew-v1.30': 'suppress',
      nps: 'defer'
    },
    slot: 'release-2.0-dialog'
  }
]

const results = (setup: Setup) => {
  const { outcomes, pushedSlot } = decideMessages(input(setup))
  return {
    slot: pushedSlot,
    results: Object.fromEntries(
      Object.entries(outcomes).map(([id, o]) => [id, o.result])
    )
  }
}

describe('decideMessages: playbook examples', () => {
  it.for(PLAYBOOK_CASES)('$id', (c) => {
    expect(results(c.setup)).toEqual({ results: c.expect, slot: c.slot })
  })
})

describe('decideMessages: runtime contract', () => {
  const reason = (setup: Setup, id: string) =>
    decideMessages(input(setup)).outcomes[id]

  it.for([
    ['no owner', { owner: undefined }, 'missing_record'],
    ['no end date', { endsAt: undefined }, 'missing_record'],
    ['kill switch on', { switchedOff: true }, 'turned_off'],
    ['end date passed', { endsAt: NOW - 1 }, 'ended'],
    ['audience excludes the user', { forUser: false }, 'not_for_user']
  ] as const)(
    'suppresses a pushed message with %s, even if cached',
    ([, overrides, expected]) => {
      expect(reason({ candidates: [message('m', overrides)] }, 'm')).toEqual({
        result: 'suppress',
        reason: expected
      })
    }
  )

  it('keeps a done message done across a text edit (same ID, new version)', () => {
    expect(
      reason(
        {
          exposure: { m: { done: true, showings: 1 } },
          candidates: [message('m', { version: 2 })]
        },
        'm'
      )
    ).toEqual({ result: 'suppress', reason: 'dismissed' })
  })

  it('shows a correction under a new ID and withdraws the one it replaces', () => {
    expect(
      results({
        exposure: { old: { done: true, showings: 1 } },
        candidates: [message('old'), message('fix', { replaces: 'old' })]
      })
    ).toEqual({ results: { old: 'suppress', fix: 'show' }, slot: 'fix' })
  })

  it.for([
    ['critical', 'show'],
    ['recommended_update', 'show'],
    ['onboarding', 'show'],
    ['announcement', 'defer']
  ] as const)(
    'with the daily push used, a pushed %s message gets %s',
    ([cls, expected]) => {
      expect(
        results({
          budget: { pushedToday: true },
          candidates: [message('m', { class: cls, form: 'card' })]
        }).results
      ).toEqual({ m: expected })
    }
  )

  it('gives one result per ID when a candidate repeats', () => {
    expect(
      results({ candidates: [message('m'), message('m', { version: 2 })] })
    ).toEqual({ results: { m: 'show' }, slot: 'm' })
  })

  it('keeps an outcome for an ID that is an object key', () => {
    expect(results({ candidates: [message('__proto__')] })).toEqual({
      results: { ['__proto__']: 'show' },
      slot: '__proto__'
    })
  })

  it('returns a critical message after 3 showings, but not other messages', () => {
    const exposure = {
      sec: { done: false, showings: 3 },
      m: { done: false, showings: 3 }
    }
    expect(
      results({
        exposure,
        candidates: [message('sec', { class: 'critical' }), message('m')]
      })
    ).toEqual({ results: { sec: 'show', m: 'suppress' }, slot: 'sec' })
  })

  it('holds a closed critical message until the next session', () => {
    expect(
      reason(
        {
          exposure: {
            sec: { done: false, showings: 1, closedThisSession: true }
          },
          candidates: [message('sec', { class: 'critical' })]
        },
        'sec'
      )
    ).toEqual({ result: 'defer', reason: 'next_session' })
  })

  it('gives an opted-in tester one extra push for feedback only', () => {
    const feedback = message('nightly-survey', {
      class: 'research',
      testerFeedback: true
    })
    const used = { pushedToday: true }
    expect(
      results({
        user: { tester: true },
        budget: used,
        candidates: [feedback, M.promo]
      })
    ).toEqual({
      results: { 'nightly-survey': 'show', 'comfy-pro-promo': 'defer' },
      slot: 'nightly-survey'
    })
    expect(
      results({
        user: { tester: true },
        budget: { ...used, testerPushToday: true },
        candidates: [feedback]
      }).results
    ).toEqual({ 'nightly-survey': 'defer' })
    expect(results({ budget: used, candidates: [feedback] }).results).toEqual({
      'nightly-survey': 'defer'
    })
  })

  it.for([
    ['hidden', 'card', 'defer'],
    ['working', 'card', 'defer'],
    ['break', 'card', 'show'],
    ['break', 'dialog', 'defer'],
    ['break', 'banner', 'defer'],
    ['session_start', 'dialog', 'show'],
    ['session_start', 'banner', 'show']
  ] as const)('at %s a pushed %s gets %s', ([moment, form, expected]) => {
    expect(
      results({ moment, candidates: [message('m', { form })] }).results
    ).toEqual({ m: expected })
  })

  it('moves a message up in its last 3 days', () => {
    const ending = message('promo', {
      class: 'promotion',
      endsAt: NOW + 2 * DAY
    })
    expect(results({ candidates: [M.whatsnew, ending] }).slot).toBe('promo')
  })

  it('moves a message up while a PM boost lasts, and not after', () => {
    const boosted = (until: number) =>
      message('nps', { class: 'research', boostedUntil: until })
    expect(results({ candidates: [M.whatsnew, boosted(NOW + DAY)] }).slot).toBe(
      'nps'
    )
    expect(results({ candidates: [M.whatsnew, boosted(NOW - 1)] }).slot).toBe(
      'whatsnew-v1.30'
    )
  })

  it('defers a snoozed message until the snooze ends', () => {
    const snoozed = (until: number) =>
      results({
        exposure: { m: { done: false, showings: 1, snoozedUntil: until } },
        candidates: [message('m')]
      }).results
    expect(snoozed(NOW + DAY)).toEqual({ m: 'defer' })
    expect(snoozed(NOW - 1)).toEqual({ m: 'show' })
  })

  it('keeps a session-start dialog on screen when the user starts something', () => {
    expect(results({ candidates: [M.major, M.agent] })).toEqual({
      results: { 'release-2.0-dialog': 'show', 'agent-onboarding': 'show' },
      slot: 'release-2.0-dialog'
    })
  })

  it('is deterministic for equal priorities', () => {
    const a = message('a')
    const b = message('b')
    expect(results({ candidates: [b, a] }).slot).toBe('a')
    expect(results({ candidates: [a, b] }).slot).toBe('a')
  })
})

describe('decideMessages: decision boundaries', () => {
  const reason = (setup: Setup, id: string) =>
    decideMessages(input(setup)).outcomes[id]
  const shown: ArbiterOutcome = { result: 'show', reason: 'highest_priority' }

  it('holds a message until its start date and shows it at that moment', () => {
    const scheduled = (startsAt: number) =>
      reason({ candidates: [message('m', { startsAt })] }, 'm')
    expect(scheduled(NOW + 1)).toEqual({ result: 'defer', reason: 'too_early' })
    expect(scheduled(NOW)).toEqual(shown)
  })

  it('suppresses a message at its end date, not a millisecond before', () => {
    const ending = (endsAt: number) =>
      reason({ candidates: [message('m', { endsAt })] }, 'm')
    expect(ending(NOW)).toEqual({ result: 'suppress', reason: 'ended' })
    expect(ending(NOW + 1)).toEqual(shown)
  })

  it.for([
    ['switched off', { switchedOff: true }, 'suppress'],
    ['outside the audience', { forUser: false }, 'suppress'],
    ['not started', { startsAt: NOW + 1 }, 'defer'],
    ['ended', { endsAt: NOW }, 'suppress'],
    ['missing its record', { owner: undefined }, 'suppress']
  ] as const)(
    'keeps the old message when the correction is %s',
    ([, overrides, correctionResult]) => {
      expect(
        results({
          candidates: [
            message('old'),
            message('fix', { replaces: 'old', ...overrides })
          ]
        })
      ).toEqual({
        results: { old: 'show', fix: correctionResult },
        slot: 'old'
      })
    }
  )

  it('shows a pushed message on its third showing and not its fourth', () => {
    const after = (showings: number) =>
      reason(
        {
          exposure: { m: { done: false, showings } },
          candidates: [message('m')]
        },
        'm'
      )
    expect(after(2)).toEqual(shown)
    expect(after(3)).toEqual({ result: 'suppress', reason: 'shown_out' })
  })

  it('ends the research cooldown at 30 days', () => {
    const since = (ago: number) =>
      reason(
        {
          lastShownAt: { research: NOW - ago },
          candidates: [message('nps', { class: 'research' })]
        },
        'nps'
      )
    expect(since(30 * DAY - 1)).toEqual({ result: 'defer', reason: 'cooldown' })
    expect(since(30 * DAY)).toEqual(shown)
  })

  it('never holds an announcement that showed today', () => {
    expect(
      reason(
        { lastShownAt: { announcement: NOW - 1 }, candidates: [message('m')] },
        'm'
      )
    ).toEqual(shown)
  })

  it('ends the early-user hold on research at 7 days', () => {
    const signedUp = (ago: number) =>
      reason(
        {
          user: { signedUpAt: NOW - ago },
          candidates: [message('nps', { class: 'research' })]
        },
        'nps'
      )
    expect(signedUp(7 * DAY - 1)).toEqual({
      result: 'defer',
      reason: 'too_early'
    })
    expect(signedUp(7 * DAY)).toEqual(shown)
  })

  it('lets a critical message through an error that holds the others', () => {
    expect(
      results({
        screen: { unresolvedError: true },
        candidates: [message('sec', { class: 'critical' }), message('m')]
      })
    ).toEqual({ results: { sec: 'show', m: 'defer' }, slot: 'sec' })
  })

  it('holds a pushed message while onboarding runs, except an onboarding one', () => {
    const during = (overrides: Partial<MessageEnvelope>) =>
      reason(
        {
          screen: { onboardingRunning: true },
          candidates: [message('m', overrides)]
        },
        'm'
      )
    expect(during({})).toEqual({ result: 'defer', reason: 'in_onboarding' })
    expect(during({ class: 'onboarding' })).toEqual(shown)
  })

  it('shows a user-started message while the user is working', () => {
    expect(results({ moment: 'working', candidates: [M.agent] })).toEqual({
      results: { 'agent-onboarding': 'show' },
      slot: null
    })
  })

  it('holds a user-started message during onboarding but not a follow-up', () => {
    const during = (m: MessageEnvelope) =>
      results({ screen: { onboardingRunning: true }, candidates: [m] }).results
    expect(during(M.agent)).toEqual({ 'agent-onboarding': 'defer' })
    expect(during(M.whatsnewAfter)).toEqual({ 'whatsnew-after-update': 'show' })
  })

  it('does not displace a critical message when the user starts something', () => {
    expect(
      results({ candidates: [message('sec', { class: 'critical' }), M.agent] })
    ).toEqual({
      results: { sec: 'show', 'agent-onboarding': 'show' },
      slot: 'sec'
    })
  })

  it('does not displace the slot for a follow-up message', () => {
    expect(results({ candidates: [M.whatsnew, M.whatsnewAfter] })).toEqual({
      results: { 'whatsnew-v1.30': 'show', 'whatsnew-after-update': 'show' },
      slot: 'whatsnew-v1.30'
    })
  })

  it('keeps a boosted message below onboarding', () => {
    expect(
      results({
        candidates: [
          message('promo', { class: 'promotion', boostedUntil: NOW + DAY }),
          message('tour', { class: 'onboarding' })
        ]
      })
    ).toEqual({ results: { tour: 'show', promo: 'defer' }, slot: 'tour' })
  })

  it('moves a message up at exactly 3 days out, and not past it', () => {
    const ending = (endsAt: number) =>
      message('promo', { class: 'promotion', endsAt })
    expect(
      results({ candidates: [M.whatsnew, ending(NOW + 3 * DAY)] }).slot
    ).toBe('promo')
    expect(
      results({ candidates: [M.whatsnew, ending(NOW + 3 * DAY + 1)] }).slot
    ).toBe('whatsnew-v1.30')
  })
})

describe('mergeExposure', () => {
  const state = (s: Partial<MessageExposure>): MessageExposure => ({
    done: false,
    showings: 0,
    ...s
  })

  it.for([
    ['done on the install', state({ done: true }), state({}), true],
    ['done on the account', state({}), state({ done: true }), true],
    ['done nowhere', state({}), state({}), false]
  ] as const)('keeps done when %s', ([, install, account, done]) => {
    expect(mergeExposure(account, install).done).toBe(done)
  })

  it('keeps the higher showing count and the later snooze', () => {
    expect(
      mergeExposure(
        state({ showings: 1, snoozedUntil: NOW + DAY }),
        state({ showings: 2, snoozedUntil: NOW + 3 * DAY })
      )
    ).toEqual({ done: false, showings: 2, snoozedUntil: NOW + 3 * DAY })
  })

  it('takes the install state when the account has none', () => {
    expect(mergeExposure(undefined, state({ showings: 2 }))).toEqual(
      state({ showings: 2 })
    )
  })

  it.for([
    ['the install', state({ closedThisSession: true }), state({})],
    ['the account', state({}), state({ closedThisSession: true })]
  ] as const)('keeps a session close from %s', ([, install, account]) => {
    expect(mergeExposure(account, install).closedThisSession).toBe(true)
  })

  it('merges two absent states into a clean one', () => {
    expect(mergeExposure(undefined, undefined)).toEqual(state({}))
  })
})
