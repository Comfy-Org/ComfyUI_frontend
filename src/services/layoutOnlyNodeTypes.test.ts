import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyLayoutOnlyDeclarations,
  declareLayoutOnlyNodeTypes,
  isLayoutOnlyNodeType
} from '@/services/layoutOnlyNodeTypes'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { createTestNodeDef } from '@/utils/__tests__/litegraphTestUtils'

describe('layoutOnlyNodeTypes', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('marks a declared type as layout-only on its node def', () => {
    declareLayoutOnlyNodeTypes(['StickyNote'])
    const nodeDefs = { StickyNote: createTestNodeDef('StickyNote') }

    applyLayoutOnlyDeclarations(nodeDefs)

    expect(nodeDefs.StickyNote.layout_only).toBe(true)
  })

  it('warns and ignores declarations for executable types', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    declareLayoutOnlyNodeTypes(['FakeSaveImage', 'FakeSampler'])
    const nodeDefs = {
      FakeSaveImage: createTestNodeDef('FakeSaveImage', { output_node: true }),
      FakeSampler: createTestNodeDef('FakeSampler', { output: ['IMAGE'] })
    }

    applyLayoutOnlyDeclarations(nodeDefs)

    expect(nodeDefs.FakeSaveImage.layout_only).toBeUndefined()
    expect(nodeDefs.FakeSampler.layout_only).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('reads layout_only from the node def store', () => {
    useNodeDefStore().updateNodeDefs([
      createTestNodeDef('StickyNote', { layout_only: true }),
      createTestNodeDef('KSampler')
    ])

    expect(isLayoutOnlyNodeType('StickyNote')).toBe(true)
    expect(isLayoutOnlyNodeType('KSampler')).toBe(false)
    expect(isLayoutOnlyNodeType('MissingType')).toBe(false)
  })
})
