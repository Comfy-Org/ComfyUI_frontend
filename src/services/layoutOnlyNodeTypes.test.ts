import { describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { applyLayoutOnlyNodeTypes } from '@/services/layoutOnlyNodeTypes'

function createNodeDef(
  name: string,
  overrides: Partial<ComfyNodeDef> = {}
): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: 'test',
    description: '',
    input: {},
    output: [],
    output_node: false,
    python_module: 'test',
    ...overrides
  }
}

describe('applyLayoutOnlyNodeTypes', () => {
  it('classifies explicitly declared frontend-only node types', () => {
    const [result] = applyLayoutOnlyNodeTypes(
      [createNodeDef('LayoutFrame')],
      new Set(['LayoutFrame']),
      new Set(['LayoutFrame'])
    )

    expect(result.layout_only).toBe(true)
  })

  it('preserves backend-provided layout-only metadata', () => {
    const [result] = applyLayoutOnlyNodeTypes(
      [createNodeDef('BackendLayout', { layout_only: true })],
      new Set(),
      new Set()
    )

    expect(result.layout_only).toBe(true)
  })

  it('does not let extensions reclassify backend or system node types', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [result] = applyLayoutOnlyNodeTypes(
      [createNodeDef('BackendNode')],
      new Set(),
      new Set(['BackendNode'])
    )

    expect(result.layout_only).not.toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('can only classify frontend-only node types')
    )
  })

  it.for([
    { output: ['*'] },
    { output_node: true }
  ] satisfies Partial<ComfyNodeDef>[])(
    'rejects contradictory final definitions: %o',
    (overrides) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const [result] = applyLayoutOnlyNodeTypes(
        [createNodeDef('ContradictoryNode', overrides)],
        new Set(['ContradictoryNode']),
        new Set(['ContradictoryNode'])
      )

      expect(result.layout_only).toBe(false)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('final node definition has outputs')
      )
    }
  )
})
