/**
 * Which workflow a turn is attributed to, and whether a tab may adopt the
 * workflow the agent mints for it.
 *
 * Every backend serves the saved-workflow index (GET /workflows), so a saved
 * tab that does NOT resolve means the list has not loaded. Sending it tab-only
 * would let the agent mint a second workflow for it; sending nothing would let
 * the turn land on the thread's previous workflow. It is marked unresolved so
 * the send refuses it instead.
 */
import { describe, expect, it } from 'vitest'

import { turnContextFor } from './turnContext'

describe('turnContextFor', () => {
  it('names the resolved workflow when the tab has one', () => {
    expect(
      turnContextFor({
        id: 'wf-1',
        tabPath: 'workflows/a.json',
        isTemporary: false,
        hasOrigin: true
      })
    ).toEqual({ id: 'wf-1', tabPath: 'workflows/a.json' })
  })

  it('marks an unresolved saved tab so the send can refuse it', () => {
    expect(
      turnContextFor({
        id: undefined,
        tabPath: 'workflows/a.json',
        isTemporary: false,
        hasOrigin: true
      })
    ).toEqual({ tabPath: 'workflows/a.json', unresolved: true })
  })

  it('always sends a tab-only context for a temporary tab', () => {
    expect(
      turnContextFor({
        id: undefined,
        tabPath: 'workflows/temp.json',
        isTemporary: true,
        hasOrigin: true
      })
    ).toEqual({ tabPath: 'workflows/temp.json' })
  })
})
