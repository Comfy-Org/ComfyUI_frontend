import { describe, expect, it } from 'vitest'

import { resolvePickingPolicy } from '@/renderer/core/canvas/interaction/pickingPolicy'

describe('resolvePickingPolicy', () => {
  it.for([
    {
      readOnly: false,
      picking: false,
      expected: {
        canSelectNodes: true,
        canEditNodes: true,
        canFocusWidgets: true
      }
    },
    {
      readOnly: false,
      picking: true,
      expected: {
        canSelectNodes: true,
        canEditNodes: false,
        canFocusWidgets: false
      }
    },
    {
      readOnly: true,
      picking: false,
      expected: {
        canSelectNodes: false,
        canEditNodes: false,
        canFocusWidgets: true
      }
    },
    {
      readOnly: true,
      picking: true,
      expected: {
        canSelectNodes: false,
        canEditNodes: false,
        canFocusWidgets: false
      }
    }
  ])(
    'readOnly=$readOnly picking=$picking',
    ({ readOnly, picking, expected }) => {
      expect(resolvePickingPolicy({ readOnly, picking })).toEqual(expected)
    }
  )
})
