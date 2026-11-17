import { describe, expect, it } from 'vitest'

import { isThinkingPanel, reducePanel } from './panelState'
import type { PanelEvent, PanelState } from './panelState'

describe('reducePanel', () => {
  it.for<{
    name: string
    from: PanelState
    event: PanelEvent
    expected: PanelState
  }>([
    {
      name: 'P-04: entering the mode from the trigger leaves a closed slot closed',
      from: 'closed',
      event: { type: 'modeEnteredFromTrigger' },
      expected: 'closed'
    },
    {
      name: 'P-04: entering the mode from the trigger leaves the list open',
      from: 'questions',
      event: { type: 'modeEnteredFromTrigger' },
      expected: 'questions'
    },
    {
      name: 'P-05: leaving the mode keeps the list when there is something to show',
      from: 'questions',
      event: { type: 'modeLeft', hasContent: true },
      expected: 'questions'
    },
    {
      name: 'P-05: leaving the mode closes the list when there is nothing to show',
      from: 'questions',
      event: { type: 'modeLeft', hasContent: false },
      expected: 'closed'
    },
    {
      name: 'P-05: leaving the mode never opens a closed slot',
      from: 'closed',
      event: { type: 'modeLeft', hasContent: true },
      expected: 'closed'
    },
    {
      name: 'P-06, BA-04: the caret opens the list from a closed slot',
      from: 'closed',
      event: { type: 'caretPressed' },
      expected: 'questions'
    },
    {
      name: 'P-06, BA-04: the caret closes an open list',
      from: 'questions',
      event: { type: 'caretPressed' },
      expected: 'closed'
    },
    {
      name: 'BA-20: the caret replaces the dock with the list, so the slot holds one thing',
      from: 'thinking',
      event: { type: 'caretPressed' },
      expected: 'questions'
    },
    {
      name: 'P-08, BA-04: the fold control closes the list',
      from: 'questions',
      event: { type: 'collapsePressed' },
      expected: 'closed'
    },
    {
      name: 'BA-06, BA-11: the fold control closes the dock, taller or not',
      from: 'thinkingTall',
      event: { type: 'collapsePressed' },
      expected: 'closed'
    },
    {
      name: 'P-11, BA-15: the darker dot of the turn strip opens the list',
      from: 'closed',
      event: { type: 'stripPressed' },
      expected: 'questions'
    },
    {
      name: 'BA-05: Send opens the dock when it is set to',
      from: 'questions',
      event: { type: 'sendStarted', opensThinking: true },
      expected: 'thinking'
    },
    {
      name: 'BA-05: Send folds the list and opens nothing when the dock is set to wait',
      from: 'questions',
      event: { type: 'sendStarted', opensThinking: false },
      expected: 'closed'
    },
    {
      name: 'BA-09: the answer folds the dock',
      from: 'thinkingTall',
      event: { type: 'requestEnded' },
      expected: 'closed'
    },
    {
      name: 'BA-18: a failure or an answer does not close a list the person opened',
      from: 'questions',
      event: { type: 'requestEnded' },
      expected: 'questions'
    },
    {
      name: 'BA-24: Ask opens a folded dock while a request is in flight',
      from: 'closed',
      event: { type: 'thinkingToggled' },
      expected: 'thinking'
    },
    {
      name: 'BA-24: Ask folds an open dock',
      from: 'thinking',
      event: { type: 'thinkingToggled' },
      expected: 'closed'
    },
    {
      name: 'BA-24: Ask folds a taller dock all the way',
      from: 'thinkingTall',
      event: { type: 'thinkingToggled' },
      expected: 'closed'
    },
    {
      name: 'BA-11: taller grows the dock',
      from: 'thinking',
      event: { type: 'tallerPressed' },
      expected: 'thinkingTall'
    },
    {
      name: 'BA-11: taller again shrinks it',
      from: 'thinkingTall',
      event: { type: 'tallerPressed' },
      expected: 'thinking'
    },
    {
      name: 'BA-11: taller means nothing outside the dock',
      from: 'questions',
      event: { type: 'tallerPressed' },
      expected: 'questions'
    },
    {
      name: 'BA-14: Start over empties the slot',
      from: 'questions',
      event: { type: 'startedOver' },
      expected: 'closed'
    }
  ])('$name', ({ from, event, expected }) => {
    expect(reducePanel(from, event)).toBe(expected)
  })

  it('knows which states are the dock', () => {
    expect(
      (['closed', 'questions', 'thinking', 'thinkingTall'] as const).map(
        isThinkingPanel
      )
    ).toEqual([false, false, true, true])
  })
})
