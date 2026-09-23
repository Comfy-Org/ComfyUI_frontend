import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it } from 'vitest'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { isValidUuid } from '@/utils/formatUtil'
import {
  areWorkflowIdsEquivalent,
  ensureWorkflowId,
  getLegacyWorkflowId
} from './workflowId'

const UUID = '9cea40bb-b0cf-4b40-a758-8935cfe8d52f'
const OTHER_UUID = '11111111-2222-3333-4444-555555555555'

interface WorkflowIdComparisonCase {
  label: string
  existingId?: string
  incomingId?: string
  existingLegacyId?: string
  expected?: true
}

const comparisonCases = [
  {
    label: 'equal UUIDs',
    existingId: UUID,
    incomingId: UUID,
    expected: true
  },
  {
    label: 'equivalent UUID casing',
    existingId: UUID,
    incomingId: UUID.toUpperCase(),
    expected: true
  },
  {
    label: 'different UUIDs',
    existingId: UUID,
    incomingId: OTHER_UUID
  },
  {
    label: 'equal legacy ids',
    existingId: 'legacy-a',
    incomingId: 'legacy-a',
    expected: true
  },
  {
    label: 'different legacy ids',
    existingId: 'legacy-a',
    incomingId: 'legacy-b'
  },
  {
    label: 'matching migration alias',
    existingId: UUID,
    incomingId: 'legacy-a',
    existingLegacyId: 'legacy-a',
    expected: true
  },
  {
    label: 'unrelated legacy id',
    existingId: UUID,
    incomingId: 'legacy-b',
    existingLegacyId: 'legacy-a'
  },
  {
    label: 'missing incoming id',
    existingId: UUID,
    expected: true
  },
  {
    label: 'missing existing id',
    incomingId: UUID,
    expected: true
  }
] as const satisfies readonly WorkflowIdComparisonCase[]

describe('workflowId', () => {
  it.for(comparisonCases)(
    'compares $label',
    ({
      existingId,
      incomingId,
      existingLegacyId,
      expected
    }: WorkflowIdComparisonCase) => {
      expect(
        areWorkflowIdsEquivalent(existingId, incomingId, existingLegacyId)
      ).toBe(expected ?? false)
    }
  )

  it('preserves a valid id', () => {
    const valid = fromPartial<ComfyWorkflowJSON>({ id: UUID })

    expect(ensureWorkflowId(valid).id).toBe(UUID)
  })

  it('uses a valid fallback without mutating a legacy workflow', () => {
    const legacy = fromPartial<ComfyWorkflowJSON>({ id: 'legacy-a' })

    expect(ensureWorkflowId(legacy, OTHER_UUID)).toEqual({ id: OTHER_UUID })
    expect(legacy.id).toBe('legacy-a')
  })

  it.for([undefined, '', 'legacy-a'])(
    'generates an id for an invalid id: %s',
    (id) => {
      const workflow = fromPartial<ComfyWorkflowJSON>({ id })

      expect(isValidUuid(ensureWorkflowId(workflow).id)).toBe(true)
    }
  )

  it('identifies only non-empty non-UUID strings as legacy ids', () => {
    expect(getLegacyWorkflowId('legacy-a')).toBe('legacy-a')
    expect(getLegacyWorkflowId(UUID)).toBeUndefined()
    expect(getLegacyWorkflowId('')).toBeUndefined()
    expect(getLegacyWorkflowId(undefined)).toBeUndefined()
  })
})
