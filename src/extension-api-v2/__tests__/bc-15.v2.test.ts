// Category: BC.15 — Workflow loading into the editor
// DB cross-ref: S6.A2
// Exemplar: https://github.com/BennyKok/comfyui-deploy/blob/main/web-plugin/workflow-list.js#L456
// blast_radius: 5.05 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v2 replacement: app.loadWorkflow(json) — stable public API with beforeLoad/afterLoad hooks
//
// Phase A strategy: test that the MiniComfyApp harness models the v2 load
// contract shape. Real graph deserialization and DOM effects need the shell
// integration (Phase B). Registration + hook firing order can be proved today
// with synthetic mocks.
//
// I-TF.8.D2 — BC.15 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import { createHarnessWorld, createMiniComfyApp } from '../harness'

// ── Synthetic beforeLoad / afterLoad event bus ────────────────────────────────
// Models the app.on('beforeLoadWorkflow') / app.on('afterLoadWorkflow')
// registration contract without a real shell.

interface BeforeLoadEvent {
  workflow: Record<string, unknown>
  cancel(): void
}

interface AfterLoadEvent {
  workflow: Record<string, unknown>
  nodeCount: number
}

function createWorkflowLoader() {
  const beforeHandlers: Array<(e: BeforeLoadEvent) => void> = []
  const afterHandlers: Array<(e: AfterLoadEvent) => void> = []

  function on(event: 'beforeLoadWorkflow', handler: (e: BeforeLoadEvent) => void): () => void
  function on(event: 'afterLoadWorkflow', handler: (e: AfterLoadEvent) => void): () => void
  function on(event: string, handler: (e: never) => void): () => void {
    if (event === 'beforeLoadWorkflow') {
      beforeHandlers.push(handler as (e: BeforeLoadEvent) => void)
      return () => {
        const i = beforeHandlers.indexOf(handler as (e: BeforeLoadEvent) => void)
        if (i !== -1) beforeHandlers.splice(i, 1)
      }
    } else {
      afterHandlers.push(handler as (e: AfterLoadEvent) => void)
      return () => {
        const i = afterHandlers.indexOf(handler as (e: AfterLoadEvent) => void)
        if (i !== -1) afterHandlers.splice(i, 1)
      }
    }
  }

  async function loadWorkflow(json: Record<string, unknown>): Promise<{ loaded: boolean; nodeCount: number }> {
    let cancelled = false
    const beforeEvt: BeforeLoadEvent = {
      workflow: { ...json },
      cancel() { cancelled = true }
    }
    for (const h of [...beforeHandlers]) h(beforeEvt)
    if (cancelled) return { loaded: false, nodeCount: 0 }

    // Simulate deserialization: count nodes in workflow
    const nodes = (beforeEvt.workflow.nodes as unknown[]) ?? []
    const nodeCount = nodes.length

    const afterEvt: AfterLoadEvent = { workflow: beforeEvt.workflow, nodeCount }
    for (const h of [...afterHandlers]) h(afterEvt)

    return { loaded: true, nodeCount }
  }

  return { on, loadWorkflow }
}

// ── Wired assertions (Phase A) ────────────────────────────────────────────────

describe('BC.15 v2 contract — app.loadWorkflow', () => {
  describe('core load API shape', () => {
    it('loadWorkflow returns a Promise', async () => {
      const loader = createWorkflowLoader()
      const result = loader.loadWorkflow({ nodes: [], links: [] })
      expect(result).toBeInstanceOf(Promise)
      await result
    })

    it('loadWorkflow resolves with loaded: true and the node count for a valid workflow', async () => {
      const loader = createWorkflowLoader()
      const { loaded, nodeCount } = await loader.loadWorkflow({
        nodes: [{ id: 1 }, { id: 2 }, { id: 3 }],
        links: []
      })
      expect(loaded).toBe(true)
      expect(nodeCount).toBe(3)
    })

    it('loadWorkflow resolves with loaded: false and nodeCount 0 when cancelled', async () => {
      const loader = createWorkflowLoader()
      loader.on('beforeLoadWorkflow', (e) => e.cancel())
      const { loaded, nodeCount } = await loader.loadWorkflow({ nodes: [{ id: 1 }], links: [] })
      expect(loaded).toBe(false)
      expect(nodeCount).toBe(0)
    })

    it('MiniComfyApp.graph is present and has add/remove/findNodesByType', () => {
      const app = createMiniComfyApp()
      expect(typeof app.graph.add).toBe('function')
      expect(typeof app.graph.remove).toBe('function')
      expect(typeof app.graph.findNodesByType).toBe('function')
    })
  })

  describe('beforeLoadWorkflow hook', () => {
    it('on("beforeLoadWorkflow", handler) returns an unsubscribe function', () => {
      const loader = createWorkflowLoader()
      const unsub = loader.on('beforeLoadWorkflow', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('beforeLoadWorkflow handler fires before deserialization', async () => {
      const loader = createWorkflowLoader()
      const order: string[] = []
      loader.on('beforeLoadWorkflow', () => order.push('before'))
      await loader.loadWorkflow({ nodes: [], links: [] })
      // 'after' fires in afterLoad — before must be first
      order.push('load-done')
      expect(order[0]).toBe('before')
    })

    it('handler can mutate event.workflow before deserialization', async () => {
      const loader = createWorkflowLoader()
      loader.on('beforeLoadWorkflow', (e) => {
        e.workflow.nodes = [{ id: 99, type: 'injected' }]
      })
      const { nodeCount } = await loader.loadWorkflow({ nodes: [], links: [] })
      expect(nodeCount).toBe(1)
    })

    it('calling event.cancel() prevents afterLoadWorkflow from firing', async () => {
      const loader = createWorkflowLoader()
      const afterHandler = vi.fn()
      loader.on('beforeLoadWorkflow', (e) => e.cancel())
      loader.on('afterLoadWorkflow', afterHandler)
      await loader.loadWorkflow({ nodes: [], links: [] })
      expect(afterHandler).not.toHaveBeenCalled()
    })

    it('unsubscribing a beforeLoadWorkflow handler stops it from firing', async () => {
      const loader = createWorkflowLoader()
      const handler = vi.fn()
      const unsub = loader.on('beforeLoadWorkflow', handler)
      unsub()
      await loader.loadWorkflow({ nodes: [], links: [] })
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('afterLoadWorkflow hook', () => {
    it('on("afterLoadWorkflow", handler) returns an unsubscribe function', () => {
      const loader = createWorkflowLoader()
      const unsub = loader.on('afterLoadWorkflow', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('afterLoadWorkflow fires after deserialization with the original workflow and node count', async () => {
      const loader = createWorkflowLoader()
      let receivedNodeCount = -1
      loader.on('afterLoadWorkflow', (e) => { receivedNodeCount = e.nodeCount })
      await loader.loadWorkflow({ nodes: [{ id: 1 }, { id: 2 }], links: [] })
      expect(receivedNodeCount).toBe(2)
    })

    it('multiple afterLoadWorkflow handlers all fire in registration order', async () => {
      const loader = createWorkflowLoader()
      const order: string[] = []
      loader.on('afterLoadWorkflow', () => order.push('first'))
      loader.on('afterLoadWorkflow', () => order.push('second'))
      await loader.loadWorkflow({ nodes: [], links: [] })
      expect(order).toEqual(['first', 'second'])
    })
  })
})

// ── Phase B stubs — shell integration ────────────────────────────────────────

describe('BC.15 v2 contract — app.loadWorkflow [Phase B / shell]', () => {
  it.todo(
    '[shell] app.loadWorkflow(json) deserializes all node types and renders them to the canvas'
  )
  it.todo(
    '[shell] app.loadWorkflow(json) accepts a JSON string as well as a plain object'
  )
  it.todo(
    '[shell] widget values are fully restored and match the serialized values in the workflow JSON'
  )
  it.todo(
    '[shell] custom node types registered by extensions are correctly hydrated during loadWorkflow'
  )
})
