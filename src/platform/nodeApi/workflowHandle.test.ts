import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { createWorkflowApi } from './workflowHandle'

const noGraph = () => undefined as unknown as LGraph | null | undefined

describe('WorkflowHandle.documentId', () => {
  it('reads through to the host-supplied reader', () => {
    // The handle does not mint or track anything itself — the loaded-workflow
    // lifecycle is `appReady`'s (one call site, `loadGraphData`'s tail),
    // and this is a read of it, not a second source of truth.
    const reader = vi.fn(() => 'doc-1')
    const api = createWorkflowApi(noGraph, undefined, reader)

    expect(api.documentId()).toBe('doc-1')
    expect(reader).toHaveBeenCalledTimes(1)
  })

  it('is undefined before any workflow has loaded', () => {
    const api = createWorkflowApi(noGraph, undefined, () => undefined)

    expect(api.documentId()).toBeUndefined()
  })
})

describe('WorkflowHandle.open', () => {
  it.for([null, [], 'workflow'])(
    'rejects invalid workflow data',
    async (data) => {
      const openWorkflow = vi.fn(() => Promise.resolve())
      const api = createWorkflowApi(noGraph, openWorkflow)

      await expect(
        Reflect.apply(api.open, api, [data]) as Promise<void>
      ).rejects.toThrow(/must be an object/)
      expect(openWorkflow).not.toHaveBeenCalled()
    }
  )

  it('rejects when workflow loading is unavailable', async () => {
    const api = createWorkflowApi(noGraph)

    await expect(api.open({ nodes: [] })).rejects.toThrow(/not connected/)
  })

  it('delegates valid workflow data', async () => {
    const openWorkflow = vi.fn(() => Promise.resolve())
    const api = createWorkflowApi(noGraph, openWorkflow)
    const workflow = { nodes: [] }

    await api.open(workflow)

    expect(openWorkflow).toHaveBeenCalledWith(workflow)
  })
})

describe('WorkflowHandle.applyTextReplacements', () => {
  it('rejects when no graph is active', () => {
    const api = createWorkflowApi(noGraph)

    expect(() => api.applyTextReplacements('text')).toThrow(/no graph/)
  })

  it('applies replacements against the root graph', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Source', 'TextSource')
    node.title = 'Prompt source'
    node.addWidget('text', 'text', 'cats/dogs', () => undefined, {})
    graph.add(node)
    const api = createWorkflowApi(() => graph)

    expect(api.applyTextReplacements('%Prompt source.text%')).toBe('cats_dogs')
  })
})
