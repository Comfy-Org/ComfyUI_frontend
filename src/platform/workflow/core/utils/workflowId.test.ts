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

describe('workflowId', () => {
  it.for([
    ['equal UUIDs', UUID, UUID, undefined, true],
    ['equivalent UUID casing', UUID, UUID.toUpperCase(), undefined, true],
    ['different UUIDs', UUID, OTHER_UUID, undefined, false],
    ['equal legacy ids', 'legacy-a', 'legacy-a', undefined, true],
    ['different legacy ids', 'legacy-a', 'legacy-b', undefined, false],
    ['matching migration alias', UUID, 'legacy-a', 'legacy-a', true],
    ['unrelated legacy id', UUID, 'legacy-b', 'legacy-a', false],
    ['missing incoming id', UUID, undefined, undefined, true],
    ['missing existing id', undefined, UUID, undefined, true]
  ] as const)(
    'compares %s',
    ([, existingId, incomingId, legacyId, expected]) => {
      expect(areWorkflowIdsEquivalent(existingId, incomingId, legacyId)).toBe(
        expected
      )
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
