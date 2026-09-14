/**
 * Which workflow a turn is attributed to, and whether a tab may adopt the
 * workflow the agent mints for it.
 *
 * In the cloud a saved tab resolves its workflow through ingest's workflow
 * list; a saved tab that does NOT resolve means the list has not loaded, and
 * sending a tab-only context would let the agent mint a second workflow for a
 * tab that already has one. Standalone has no such list — the tab binding is
 * the only source of truth — so an unbound saved tab is simply a tab the agent
 * has not been given a workflow for yet, exactly like a temporary one.
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
        hasOrigin: true,
        bindingIsAuthoritative: false
      })
    ).toEqual({ id: 'wf-1', tabPath: 'workflows/a.json' })
  })

  it('withholds the context for an unresolved saved tab when a cloud list is authoritative', () => {
    expect(
      turnContextFor({
        id: undefined,
        tabPath: 'workflows/a.json',
        isTemporary: false,
        hasOrigin: true,
        bindingIsAuthoritative: false
      })
    ).toBeUndefined()
  })

  it('sends a tab-only context for an unresolved saved tab when the binding is authoritative', () => {
    expect(
      turnContextFor({
        id: undefined,
        tabPath: 'workflows/a.json',
        isTemporary: false,
        hasOrigin: true,
        bindingIsAuthoritative: true
      })
    ).toEqual({ tabPath: 'workflows/a.json' })
  })

  it('always sends a tab-only context for a temporary tab', () => {
    expect(
      turnContextFor({
        id: undefined,
        tabPath: 'workflows/temp.json',
        isTemporary: true,
        hasOrigin: true,
        bindingIsAuthoritative: false
      })
    ).toEqual({ tabPath: 'workflows/temp.json' })
  })
})
