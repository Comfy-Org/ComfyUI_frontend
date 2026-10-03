import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'

import { createWorkflowApi } from './workflowHandle'

const noGraph = () => undefined as unknown as LGraph | null | undefined

describe('WorkflowHandle.documentId', () => {
  it('reads through to the host-supplied reader', () => {
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

describe('WorkflowHandle.current', () => {
  const document = {
    sessionId: 'session-a',
    filename: 'portrait',
    path: 'workflows/portrait.json',
    isModified: true,
    isActive: true
  }

  it('describes the document on screen', () => {
    const api = createWorkflowApi(noGraph, undefined, undefined, () => [
      document
    ])

    const current = api.current()

    expect(current?.id).toBe('session-a')
    expect(current?.name).toBe('portrait')
    expect(current?.isModified).toBe(true)
    expect(current?.isDeleted).toBe(false)
  })

  it('agrees with documentId', () => {
    const api = createWorkflowApi(
      noGraph,
      undefined,
      () => 'session-a',
      () => [document]
    )

    expect(api.current()?.id).toBe(api.documentId())
  })

  it('is undefined before a document is open', () => {
    const api = createWorkflowApi(noGraph, undefined, undefined, () => [])

    expect(api.current()).toBeUndefined()
  })

  it('is undefined for a file whose session has not begun', () => {
    const api = createWorkflowApi(noGraph, undefined, undefined, () => [
      { ...document, sessionId: null }
    ])

    expect(api.current()).toBeUndefined()
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

    expect(openWorkflow).toHaveBeenCalledWith(workflow, { mode: 'replace' })
  })

  it('delegates a separately named workflow document', async () => {
    const openWorkflow = vi.fn(() => Promise.resolve())
    const api = createWorkflowApi(noGraph, openWorkflow)
    const workflow = { nodes: [] }

    await api.open(workflow, { mode: 'new', name: 'Recovered snapshot' })

    expect(openWorkflow).toHaveBeenCalledWith(workflow, {
      mode: 'new',
      name: 'Recovered snapshot'
    })
  })

  it.for([
    { options: null, message: /must be an object/ },
    { options: [], message: /must be an object/ },
    { options: { mode: 'append' }, message: /mode must be/ },
    {
      options: { mode: 'replace', name: 'Renamed' },
      message: /requires mode new/
    },
    { options: { mode: 'new', name: '' }, message: /bounded display name/ },
    {
      options: { mode: 'new', name: '../escape' },
      message: /bounded display name/
    },
    {
      options: { mode: 'new', name: 'folder\\escape' },
      message: /bounded display name/
    },
    {
      options: { mode: 'new', name: `x${'a'.repeat(128)}` },
      message: /bounded display name/
    },
    { options: { mode: 'new', extra: true }, message: /unknown field/ }
  ])('rejects invalid workflow options %#', async ({ options, message }) => {
    const openWorkflow = vi.fn(() => Promise.resolve())
    const api = createWorkflowApi(noGraph, openWorkflow)

    await expect(
      Reflect.apply(api.open, api, [{ nodes: [] }, options]) as Promise<void>
    ).rejects.toThrow(message)
    expect(openWorkflow).not.toHaveBeenCalled()
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
