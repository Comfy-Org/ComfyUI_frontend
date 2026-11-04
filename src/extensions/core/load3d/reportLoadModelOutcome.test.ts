import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { reportLoadModelOutcome } from '@/extensions/core/load3d/reportLoadModelOutcome'

describe('reportLoadModelOutcome', () => {
  it.for([
    { outcome: 'loaded', silentOnNotFound: false, warnings: [] },
    { outcome: 'cancelled', silentOnNotFound: false, warnings: [] },
    { outcome: 'empty', silentOnNotFound: false, warnings: [] },
    {
      outcome: 'unknown-type',
      silentOnNotFound: true,
      warnings: [['Could not determine file type']]
    },
    {
      outcome: 'not-found',
      silentOnNotFound: false,
      warnings: [['Error loading model']]
    },
    { outcome: 'not-found', silentOnNotFound: true, warnings: [] },
    {
      outcome: 'failed',
      silentOnNotFound: true,
      warnings: [['Error loading model']]
    }
  ] as const)(
    'warns $warnings for $outcome when silentOnNotFound is $silentOnNotFound',
    ({ outcome, silentOnNotFound, warnings }) => {
      reportLoadModelOutcome(outcome, { silentOnNotFound })

      expect(vi.mocked(useToast().warning).mock.calls).toEqual(warnings)
    }
  )
})
