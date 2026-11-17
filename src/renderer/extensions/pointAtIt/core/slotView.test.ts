import { describe, expect, it } from 'vitest'

import { messages } from './messages'
import { askName, askPressed, askRole, askTitle, slotView } from './slotView'
import type { AskRole, SlotFacts, SlotView } from './slotView'
import type { ThinkingLog } from './thinkingLog'

const streaming: ThinkingLog = {
  requestId: 'request-1',
  text: 'Looking at the workflow.',
  done: false
}
const finished: ThinkingLog = { ...streaming, done: true }
const empty: ThinkingLog = { requestId: 'request-1', text: '', done: false }
const base: SlotFacts = {
  panel: 'closed',
  phase: 'idle',
  hasDraft: false,
  unsent: 0,
  thinking: null
}

describe('slotView', () => {
  it.for<{ name: string; facts: Partial<SlotFacts>; expected: SlotView }>([
    {
      name: 'BA-01: idle shows nothing',
      facts: {},
      expected: { kind: 'none' }
    },
    {
      name: 'BA-02: the mode on with nothing asked shows the hint',
      facts: { phase: 'annotating' },
      expected: { kind: 'hint' }
    },
    {
      name: 'SR-01: the mode on with an unsent question shows the summary row',
      facts: { phase: 'annotating', unsent: 2 },
      expected: { kind: 'summary' }
    },
    {
      name: 'SR-06: a box open on a target shows no summary row',
      facts: { phase: 'annotating', hasDraft: true, unsent: 2 },
      expected: { kind: 'none' }
    },
    {
      name: 'SR-03: the list replaces the summary row',
      facts: { panel: 'questions', phase: 'annotating', unsent: 2 },
      expected: { kind: 'questions' }
    },
    {
      name: 'SR-07: a waiting request shows its line, not the summary row',
      facts: { phase: 'waiting', unsent: 2 },
      expected: { kind: 'waiting' }
    },
    {
      name: 'SR-07: a failure shows its line, not the summary row',
      facts: { phase: 'failed', unsent: 2 },
      expected: { kind: 'failure' }
    },
    {
      name: 'SR-08: finished thinking from an earlier turn does not hide the summary row',
      facts: { phase: 'annotating', unsent: 1, thinking: finished },
      expected: { kind: 'summary' }
    },
    {
      name: 'SR-09: with the mode off, unsent questions show no summary row',
      facts: { phase: 'idle', unsent: 2 },
      expected: { kind: 'none' }
    },
    {
      name: 'BA-03: the mode on with a box open shows nothing',
      facts: { phase: 'annotating', hasDraft: true },
      expected: { kind: 'none' }
    },
    {
      name: 'BA-04: the list wins over everything the request would show',
      facts: { panel: 'questions', phase: 'failed', thinking: streaming },
      expected: { kind: 'questions' }
    },
    {
      name: 'BA-05: the dock shows the thinking while it is asked for',
      facts: { panel: 'thinking', phase: 'waiting', thinking: streaming },
      expected: { kind: 'thinking', tall: false }
    },
    {
      name: 'BA-07: the dock is there before the first word arrives',
      facts: { panel: 'thinking', phase: 'waiting', thinking: empty },
      expected: { kind: 'thinking', tall: false }
    },
    {
      name: 'BA-11: the dock can be taller',
      facts: { panel: 'thinkingTall', phase: 'idle', thinking: finished },
      expected: { kind: 'thinking', tall: true }
    },
    {
      name: 'BA-06: a waiting request with the dock folded is one line',
      facts: { phase: 'waiting', thinking: streaming },
      expected: { kind: 'waiting' }
    },
    {
      name: 'BA-08: a waiting request without thinking is one line',
      facts: { phase: 'waiting' },
      expected: { kind: 'waiting' }
    },
    {
      name: 'BA-09: an answer leaves the slot empty, also while the mode is on; the strip holds the thinking',
      facts: { phase: 'annotating', thinking: finished },
      expected: { kind: 'none' }
    },
    {
      name: 'BA-12: a follow-up that is waiting leaves the slot empty',
      facts: { phase: 'guiding', thinking: streaming },
      expected: { kind: 'none' }
    },
    {
      name: 'BA-10: an answer without thinking says so',
      facts: { phase: 'guiding', thinking: { ...empty, done: true } },
      expected: { kind: 'noThinking' }
    },
    {
      name: 'BA-17: a failure with the list folded is one line',
      facts: { phase: 'failed', unsent: 2, thinking: finished },
      expected: { kind: 'failure' }
    },
    {
      name: 'BA-20: a dock asked for while there is no thinking is not drawn',
      facts: { panel: 'thinking', phase: 'idle' },
      expected: { kind: 'none' }
    },
    {
      name: 'BA-20: a dock asked for when the request failed gives way to the failure',
      facts: { panel: 'thinking', phase: 'failed' },
      expected: { kind: 'failure' }
    }
  ])('$name', ({ facts, expected }) => {
    expect(slotView({ ...base, ...facts })).toEqual(expected)
  })
})

describe('askRole', () => {
  it.for<{ name: string; facts: Partial<SlotFacts>; expected: AskRole }>([
    {
      name: 'BA-24: idle, Ask toggles the mode',
      facts: {},
      expected: 'mode'
    },
    {
      name: 'BA-24: the mode on with an answer showing, Ask still toggles the mode',
      facts: { phase: 'annotating', thinking: finished },
      expected: 'mode'
    },
    {
      name: 'BA-24: a request in flight with the dock folded, Ask opens the thinking',
      facts: { phase: 'waiting', thinking: streaming },
      expected: 'thinkingFolded'
    },
    {
      name: 'BA-24: a request in flight with the dock open, Ask folds the thinking',
      facts: { panel: 'thinking', phase: 'waiting', thinking: streaming },
      expected: 'thinkingOpen'
    },
    {
      name: 'BA-24: the dock counts as open before the first word and when taller',
      facts: { panel: 'thinkingTall', phase: 'waiting', thinking: empty },
      expected: 'thinkingOpen'
    },
    {
      name: 'BA-08: a request in flight without thinking has nothing to toggle',
      facts: { phase: 'waiting' },
      expected: 'mode'
    },
    {
      name: 'BA-12: a waiting follow-up keeps its thinking in the bubble, Ask stays the mode’s',
      facts: { phase: 'guiding', thinking: streaming },
      expected: 'mode'
    },
    {
      name: 'BA-24: once the request has failed Ask is the mode’s again',
      facts: { phase: 'failed', thinking: finished },
      expected: 'mode'
    }
  ])('$name', ({ facts, expected }) => {
    expect(askRole({ ...base, ...facts })).toBe(expected)
  })
})

describe('askTitle', () => {
  it.for<{ role: AskRole; expected: string }>([
    { role: 'mode', expected: messages.annotateTooltip },
    { role: 'thinkingFolded', expected: messages.showThinking },
    { role: 'thinkingOpen', expected: messages.hideThinking }
  ])(
    'CP-03, BA-24: names what Ask does in the $role role',
    ({ role, expected }) => {
      expect(askTitle(role)).toBe(expected)
    }
  )
})

describe('askName', () => {
  it.for<{ role: AskRole; expected: string }>([
    { role: 'mode', expected: messages.annotate },
    { role: 'thinkingFolded', expected: messages.askThinking },
    { role: 'thinkingOpen', expected: messages.askThinking }
  ])(
    'CP-24, BA-24: names the Ask control for assistive technology in the $role role',
    ({ role, expected }) => {
      expect(askName(role)).toBe(expected)
    }
  )
})

describe('askPressed', () => {
  it.for<{
    name: string
    role: AskRole
    annotating: boolean
    expected: boolean
  }>([
    {
      name: 'the mode on reads as pressed in the mode role',
      role: 'mode',
      annotating: true,
      expected: true
    },
    {
      name: 'the mode off does not',
      role: 'mode',
      annotating: false,
      expected: false
    },
    {
      name: 'an open thinking box reads as pressed',
      role: 'thinkingOpen',
      annotating: false,
      expected: true
    },
    {
      name: 'a folded thinking box does not',
      role: 'thinkingFolded',
      annotating: false,
      expected: false
    },
    {
      name: 'the mode being on does not press the thinking toggle',
      role: 'thinkingFolded',
      annotating: true,
      expected: false
    }
  ])('CP-24, BA-24: $name', ({ role, annotating, expected }) => {
    expect(askPressed(role, { annotating })).toBe(expected)
  })
})
