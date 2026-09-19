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
        canOpenMenus: true,
        suppressesCanvasInfo: false
      }
    },
    {
      readOnly: false,
      picking: true,
      expected: {
        canSelectNodes: true,
        canEditNodes: false,
        canOpenMenus: false,
        suppressesCanvasInfo: true
      }
    },
    {
      readOnly: true,
      picking: false,
      expected: {
        canSelectNodes: false,
        canEditNodes: false,
        canOpenMenus: false,
        suppressesCanvasInfo: false
      }
    },
    {
      readOnly: true,
      picking: true,
      expected: {
        canSelectNodes: false,
        canEditNodes: false,
        canOpenMenus: false,
        suppressesCanvasInfo: true
      }
    }
  ])(
    'readOnly=$readOnly picking=$picking',
    ({ readOnly, picking, expected }) => {
      expect(resolvePickingPolicy({ readOnly, picking })).toEqual(expected)
    }
  )
})
