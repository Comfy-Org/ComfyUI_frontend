import { describe, expect, it } from 'vitest'

import { reducePanel } from './panelState'
import type { PanelEvent, PanelState } from './panelState'

describe('reducePanel', () => {
  it.for<{
    name: string
    open: PanelState
    event: PanelEvent
    expected: PanelState
  }>([
    {
      name: 'P-04: entering the mode from the trigger opens it',
      open: 'closed',
      event: { type: 'modeEnteredFromTrigger' },
      expected: 'open'
    },
    {
      name: 'P-05: leaving the mode keeps it when there is something to show',
      open: 'open',
      event: { type: 'modeLeft', hasContent: true },
      expected: 'open'
    },
    {
      name: 'P-05: leaving the mode closes it when there is nothing to show',
      open: 'open',
      event: { type: 'modeLeft', hasContent: false },
      expected: 'closed'
    },
    {
      name: 'P-05: leaving the mode never opens a closed panel',
      open: 'closed',
      event: { type: 'modeLeft', hasContent: true },
      expected: 'closed'
    },
    {
      name: 'P-06: the caret opens a closed panel',
      open: 'closed',
      event: { type: 'caretPressed' },
      expected: 'open'
    },
    {
      name: 'P-06: the caret closes an open panel',
      open: 'open',
      event: { type: 'caretPressed' },
      expected: 'closed'
    },
    {
      name: 'P-08: the collapse control closes it',
      open: 'open',
      event: { type: 'collapsePressed' },
      expected: 'closed'
    },
    {
      name: 'P-11: the strip under the trigger opens it',
      open: 'closed',
      event: { type: 'stripPressed' },
      expected: 'open'
    }
  ])('$name', ({ open, event, expected }) => {
    expect(reducePanel(open, event)).toBe(expected)
  })
})
