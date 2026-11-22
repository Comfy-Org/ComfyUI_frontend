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

/** The messages the playbook examples use. */
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

/**
 * Every example on the playbook's "Rules in detail" page, with the
 * playbook result mapped: shows -> show, waits -> defer,
 * blocked -> suppress, closes -> displace.
 */
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

  it('lets critical messages and recommended updates skip the daily budget', () => {
    expect(
      results({
        budget: { pushedToday: true },
        candidates: [
          message('sec', { class: 'critical' }),
          message('upd', { class: 'recommended_update' }),
          M.whatsnew
        ]
      })
    ).toEqual({
      results: { sec: 'show', upd: 'defer', 'whatsnew-v1.30': 'defer' },
      slot: 'sec'
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
    ['session_start', 'dialog', 'show']
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
})
