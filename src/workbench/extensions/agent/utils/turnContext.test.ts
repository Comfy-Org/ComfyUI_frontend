import { describe, expect, it } from 'vitest'

import { turnContextFor } from './turnContext'

describe('turnContextFor', () => {
  it.for([
    {
      label: 'names the resolved workflow when the tab has one',
      input: { id: 'wf-1', isTemporary: false, hasOrigin: true },
      expected: { id: 'wf-1', tabPath: 'workflows/a.json' }
    },
    {
      label: 'marks an unresolved saved origin tab so the send can refuse it',
      input: { id: undefined, isTemporary: false, hasOrigin: true },
      expected: { tabPath: 'workflows/a.json', unresolved: true }
    },
    {
      label: 'sends an unresolved temporary tab tab-only',
      input: { id: undefined, isTemporary: true, hasOrigin: true },
      expected: { tabPath: 'workflows/a.json' }
    },
    {
      label:
        'sends an unresolved saved tab tab-only when the send named no origin',
      input: { id: undefined, isTemporary: false, hasOrigin: false },
      expected: { tabPath: 'workflows/a.json' }
    }
  ])('$label', ({ input, expected }) => {
    expect(turnContextFor({ ...input, tabPath: 'workflows/a.json' })).toEqual(
      expected
    )
  })
})
