// Category: BC.15 — Workflow loading into the editor
// DB cross-ref: S6.A2
// Exemplar: https://github.com/BennyKok/comfyui-deploy/blob/main/web-plugin/workflow-list.js#L456
// blast_radius: 5.05 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// Migration: v1 app.loadGraphData(json) → v2 app.loadWorkflow(json) with lifecycle hooks
//
// Phase A strategy: prove that v1 interception (wrapping loadGraphData) and
// v2 interception (beforeLoadWorkflow handler) produce structurally equivalent
// outcomes on synthetic workflow fixtures. Shell rendering is todo(Phase B).
//
// I-TF.8.D2 — BC.15 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import { createMiniComfyApp } from '../harness'

// ── V1 app shim with loadGraphData ────────────────────────────────────────────

interface WorkflowJSON { nodes: Array<{ id: number; type: string }>; links: unknown[] }

function createV1App() {
  const loadLog: WorkflowJSON[] = []
  let _loadGraphData = (json: WorkflowJSON) => { loadLog.push(json) }

  return {
    get loadGraphData() { return _loadGraphData },
    set loadGraphData(fn: (json: WorkflowJSON) => void) { _loadGraphData = fn },
    get loadLog() { return loadLog },
    callLoad(json: WorkflowJSON) { _loadGraphData(json) }
  }
}

// ── V2 workflow loader (same as bc-15.v2) ────────────────────────────────────

interface BeforeLoadEvent { workflow: WorkflowJSON; cancel(): void }
interface AfterLoadEvent { workflow: WorkflowJSON; nodeCount: number }

function createV2Loader() {
  const beforeHandlers: Array<(e: BeforeLoadEvent) => void> = []
  const afterHandlers: Array<(e: AfterLoadEvent) => void> = []
  const loadLog: WorkflowJSON[] = []

  function on(event: 'beforeLoadWorkflow', h: (e: BeforeLoadEvent) => void): () => void
  function on(event: 'afterLoadWorkflow', h: (e: AfterLoadEvent) => void): () => void
  function on(event: string, h: (e: never) => void): () => void {
    const arr = event === 'beforeLoadWorkflow' ? beforeHandlers : afterHandlers as never[]
    arr.push(h as never)
    return () => { const i = arr.indexOf(h as never); if (i !== -1) arr.splice(i, 1) }
  }

  async function loadWorkflow(json: WorkflowJSON): Promise<{ loaded: boolean }> {
    let cancelled = false
    const evt: BeforeLoadEvent = { workflow: { ...json, nodes: [...json.nodes] }, cancel() { cancelled = true } }
    for (const h of [...beforeHandlers]) h(evt)
    if (cancelled) return { loaded: false }
    loadLog.push(evt.workflow)
    const afterEvt: AfterLoadEvent = { workflow: evt.workflow, nodeCount: evt.workflow.nodes.length }
    for (const h of [...afterHandlers]) h(afterEvt)
    return { loaded: true }
  }

  return { on, loadWorkflow, loadLog }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.15 migration — workflow loading', () => {
  describe('load call-count parity', () => {
    it('v1 loadGraphData and v2 loadWorkflow each called once per load invocation', async () => {
      const v1 = createV1App()
      const v2 = createV2Loader()
      const workflow: WorkflowJSON = { nodes: [{ id: 1, type: 'KSampler' }], links: [] }

      v1.callLoad(workflow)
      await v2.loadWorkflow(workflow)

      expect(v1.loadLog).toHaveLength(1)
      expect(v2.loadLog).toHaveLength(1)
    })
  })

  describe('interception migration — beforeLoad vs loadGraphData monkey-patch', () => {
    it('v1 mutation via loadGraphData wrapper and v2 mutation via beforeLoadWorkflow both alter the loaded workflow', async () => {
      const v1 = createV1App()
      const v2 = createV2Loader()
      const v1Seen: WorkflowJSON[] = []
      const v2Seen: WorkflowJSON[] = []

      // v1: wrap loadGraphData to inject a node
      const origV1 = v1.loadGraphData
      v1.loadGraphData = (json) => {
        const mutated = { ...json, nodes: [...json.nodes, { id: 99, type: 'injected' }] }
        v1Seen.push(mutated)
        origV1(mutated)
      }

      // v2: beforeLoadWorkflow handler to inject a node
      v2.on('beforeLoadWorkflow', (e) => {
        e.workflow.nodes.push({ id: 99, type: 'injected' })
        v2Seen.push({ ...e.workflow })
      })

      const base: WorkflowJSON = { nodes: [{ id: 1, type: 'KSampler' }], links: [] }
      v1.callLoad(base)
      await v2.loadWorkflow(base)

      expect(v1Seen[0].nodes).toHaveLength(2)
      expect(v2Seen[0].nodes).toHaveLength(2)
      expect(v1Seen[0].nodes[1].type).toBe('injected')
      expect(v2Seen[0].nodes[1].type).toBe('injected')
    })
  })

  describe('cancellation migration', () => {
    it('v1 no-op wrapper (skip orig call) and v2 event.cancel() both suppress the load', async () => {
      const v1 = createV1App()
      const v2 = createV2Loader()

      // v1: wrapper that swallows the call
      v1.loadGraphData = (_json) => { /* intentionally empty — suppressed */ }

      // v2: cancel via beforeLoadWorkflow
      v2.on('beforeLoadWorkflow', (e) => e.cancel())

      const workflow: WorkflowJSON = { nodes: [{ id: 1, type: 'A' }], links: [] }
      v1.callLoad(workflow)
      const { loaded } = await v2.loadWorkflow(workflow)

      expect(v1.loadLog).toHaveLength(0) // inner original was not called
      expect(loaded).toBe(false)
      expect(v2.loadLog).toHaveLength(0)
    })
  })

  describe('post-load logic migration', () => {
    it('v1 synchronous code after loadGraphData and v2 afterLoadWorkflow handler both see the loaded state', async () => {
      const v1App = createMiniComfyApp()
      const v2 = createV2Loader()
      const v1SeenCount: number[] = []
      const v2SeenCount: number[] = []

      // v1: synchronous post-load
      const workflow: WorkflowJSON = { nodes: [{ id: 1, type: 'A' }, { id: 2, type: 'B' }], links: [] }
      for (const n of workflow.nodes) v1App.graph.add({ type: n.type })
      v1SeenCount.push(v1App.world.allNodes().length)

      // v2: afterLoadWorkflow handler
      v2.on('afterLoadWorkflow', (e) => v2SeenCount.push(e.nodeCount))
      await v2.loadWorkflow(workflow)

      expect(v1SeenCount[0]).toBe(2)
      expect(v2SeenCount[0]).toBe(2)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.15 migration — workflow loading [Phase B / shell]', () => {
  it.todo(
    '[shell] v1 app.loadGraphData(json) and v2 app.loadWorkflow(json) produce identical canvas states for the same workflow'
  )
  it.todo(
    '[shell] widget values are preserved identically between v1 and v2 load paths'
  )
  it.todo(
    '[shell] custom node types registered by extensions are correctly hydrated by both load paths'
  )
  it.todo(
    '[shell] calling v2 app.loadWorkflow does not break extensions that still listen on the legacy nodeCreated hook'
  )
})
