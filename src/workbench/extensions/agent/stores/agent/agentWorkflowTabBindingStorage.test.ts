import { describe, expect, it } from 'vitest'

import { MAX_AGENT_STORAGE_CLOCK_SKEW_MS } from '@/workbench/extensions/agent/persistenceTime'

import {
  liveAgentWorkflowTabBindings,
  readPersistedAgentWorkflowTabPath
} from './agentWorkflowTabBindingStorage'

describe('liveAgentWorkflowTabBindings', () => {
  const now = Date.UTC(2026, 8, 22)
  const binding = {
    tabPath: 'workflows/example.json',
    graphId: 'graph-1'
  }

  it.for([
    {
      label: 'a timestamp beyond the clock-skew tolerance',
      confirmedAt: now + MAX_AGENT_STORAGE_CLOCK_SKEW_MS + 1
    },
    {
      label: 'a non-finite timestamp',
      confirmedAt: Number.POSITIVE_INFINITY
    },
    {
      label: 'an expired timestamp',
      confirmedAt: now - 30 * 24 * 60 * 60 * 1000 - 1
    }
  ])('rejects $label', ({ confirmedAt }) => {
    expect(
      liveAgentWorkflowTabBindings(
        { workflow: { ...binding, confirmedAt } },
        now
      )
    ).toEqual({})
  })

  it('keeps a finite timestamp within the retention window', () => {
    const record = { ...binding, confirmedAt: now }

    expect(liveAgentWorkflowTabBindings({ workflow: record }, now)).toEqual({
      workflow: record
    })
  })

  it('keeps a fresh binding after a small backward clock adjustment', () => {
    const record = { ...binding, confirmedAt: now }

    expect(
      liveAgentWorkflowTabBindings({ workflow: record }, now - 60_000)
    ).toEqual({ workflow: record })
  })
})

describe('readPersistedAgentWorkflowTabPath', () => {
  const now = Date.UTC(2026, 8, 22)

  it.for([
    { label: 'missing storage', raw: null },
    { label: 'invalid JSON', raw: '{' },
    { label: 'a non-object value', raw: 'null' },
    {
      label: 'an expired binding',
      raw: JSON.stringify({
        requested: {
          tabPath: 'workflows/expired.json',
          graphId: null,
          confirmedAt: now - 30 * 24 * 60 * 60 * 1000 - 1
        }
      })
    }
  ])('returns undefined for $label', ({ raw }) => {
    expect(readPersistedAgentWorkflowTabPath(raw, 'requested', now)).toBe(
      undefined
    )
  })

  it('returns only the requested live workflow path', () => {
    const raw = JSON.stringify({
      other: {
        tabPath: 'workflows/other.json',
        graphId: 'graph-other',
        confirmedAt: now
      },
      requested: {
        tabPath: 'workflows/requested.json',
        graphId: 'graph-requested',
        confirmedAt: now
      }
    })

    expect(readPersistedAgentWorkflowTabPath(raw, 'requested', now)).toBe(
      'workflows/requested.json'
    )
    expect(readPersistedAgentWorkflowTabPath(raw, 'missing', now)).toBe(
      undefined
    )
  })
})
