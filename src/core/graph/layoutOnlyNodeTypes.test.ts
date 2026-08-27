import { describe, expect, it, vi } from 'vitest'

import { applyLayoutOnlyNodeTypes } from '@/core/graph/layoutOnlyNodeTypes'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [result] = applyLayoutOnlyNodeTypes([createNodeDef('LayoutFrame')], {
      trustedLayoutOnlyNodeDefs: new Set(),
      nodeDefSourceTypes: new Map(),
      frontendOnlyNodeTypes: new Set(['LayoutFrame']),
      skippedFrontendOnlyNodeTypes: new Set(),
      declaredLayoutOnlyNodeTypes: new Set(['LayoutFrame'])
    })

    expect(result.layout_only).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('preserves backend-provided layout-only metadata', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nodeDef = createNodeDef('BackendLayout', { layout_only: true })
    const [result] = applyLayoutOnlyNodeTypes([nodeDef], {
      trustedLayoutOnlyNodeDefs: new Set([nodeDef]),
      nodeDefSourceTypes: new Map([[nodeDef, 'BackendLayout']]),
      frontendOnlyNodeTypes: new Set(),
      skippedFrontendOnlyNodeTypes: new Set(),
      declaredLayoutOnlyNodeTypes: new Set()
    })

    expect(result.layout_only).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not let extensions reclassify backend or system node types', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [result] = applyLayoutOnlyNodeTypes([createNodeDef('BackendNode')], {
      trustedLayoutOnlyNodeDefs: new Set(),
      nodeDefSourceTypes: new Map(),
      frontendOnlyNodeTypes: new Set(),
      skippedFrontendOnlyNodeTypes: new Set(),
      declaredLayoutOnlyNodeTypes: new Set(['BackendNode'])
    })

    expect(result.layout_only).not.toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('can only classify frontend-only node types')
    )
  })

  it('rejects layout-only metadata added after the trust snapshot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nodeDef = createNodeDef('HookMutatedNode')
    const trustedLayoutOnlyNodeDefs = new Set<ComfyNodeDef>()
    nodeDef.layout_only = true

    const [result] = applyLayoutOnlyNodeTypes([nodeDef], {
      trustedLayoutOnlyNodeDefs,
      nodeDefSourceTypes: new Map([[nodeDef, 'HookMutatedNode']]),
      frontendOnlyNodeTypes: new Set(),
      skippedFrontendOnlyNodeTypes: new Set(),
      declaredLayoutOnlyNodeTypes: new Set()
    })

    expect(result.layout_only).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Ignoring untrusted layout-only metadata')
    )
  })

  it('explains why skip_list frontend-only types are ineligible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    applyLayoutOnlyNodeTypes([], {
      trustedLayoutOnlyNodeDefs: new Set(),
      nodeDefSourceTypes: new Map(),
      frontendOnlyNodeTypes: new Set(),
      skippedFrontendOnlyNodeTypes: new Set(['HiddenLayoutFrame']),
      declaredLayoutOnlyNodeTypes: new Set(['HiddenLayoutFrame'])
    })

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'skip_list node types do not have Vue node definitions'
      )
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
        {
          trustedLayoutOnlyNodeDefs: new Set(),
          nodeDefSourceTypes: new Map(),
          frontendOnlyNodeTypes: new Set(['ContradictoryNode']),
          skippedFrontendOnlyNodeTypes: new Set(),
          declaredLayoutOnlyNodeTypes: new Set(['ContradictoryNode'])
        }
      )

      expect(result.layout_only).toBe(false)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('final node definition has outputs')
      )
    }
  )

  it('restores immutable node type identities after hook mutation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nodeDef = createNodeDef('Note', { layout_only: true })
    const nodeDefSourceTypes = new Map<ComfyNodeDef, string>([
      [nodeDef, 'Note']
    ])
    nodeDef.name = 'ExecutableBackendNode'

    const [result] = applyLayoutOnlyNodeTypes([nodeDef], {
      trustedLayoutOnlyNodeDefs: new Set([nodeDef]),
      nodeDefSourceTypes,
      frontendOnlyNodeTypes: new Set(),
      skippedFrontendOnlyNodeTypes: new Set(),
      declaredLayoutOnlyNodeTypes: new Set()
    })

    expect(result.name).toBe('Note')
    expect(result.layout_only).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('node type identities are immutable')
    )
  })
})
