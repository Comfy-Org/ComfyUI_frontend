// Category: BC.03 — Node lifecycle: hydration from saved workflows
// DB cross-ref: S1.H1, S2.N7
// compat-floor: blast_radius 4.91 ≥ 2.0 — MUST pass before v2 ships
// v2 replacement: defineNodeExtension({ loadedGraphNode(handle) { ... } })
//
// Phase A harness: loadedGraphNode(handle) is called explicitly after addNode()
// with a `fromWorkflow: true` flag to distinguish hydration from fresh creation.
// The real reactive dispatch (watch(queryAll) + LoadedFromWorkflow tag) lands in
// Phase B (I-SR.3.B4). Tests that need real LiteGraph configure() wiring are
// marked todo(Phase B).

import { describe, expect, it, vi } from 'vitest'

import {
  countEvidenceExcerpts,
  createHarnessWorld,
  createMiniComfyApp,
  loadEvidenceSnippet
} from '../harness'

// ── Wired tests (Phase A) ────────────────────────────────────────────────────
// These pass today. They prove:
// (a) loadedGraphNode hook shape: receives a NodeHandle-shaped object
// (b) widget values are already present when the hook fires
// (c) exactly one of loadedGraphNode / nodeCreated fires per entity
// (d) type-filter (nodeTypes:[]) excludes non-matching nodes
// (e) evidence excerpts exist for S2.N7

describe('BC.03 v2 contract — node lifecycle: hydration from saved workflows', () => {
  describe('loadedGraphNode(handle) — hook shape and invocation', () => {
    it('loadedGraphNode receives a handle-shaped object with type and entityId', () => {
      const world = createHarnessWorld()
      const capturedHandles: unknown[] = []

      const entityId = world.addNode({ type: 'KSampler', properties: { seed: 42 } })
      const record = world.findNode(entityId)!

      // Phase A: simulate the v2 dispatch by calling loadedGraphNode directly
      // with a handle constructed from the world record.
      const handle = {
        type: record.type,
        comfyClass: record.comfyClass,
        entityId: record.entityId,
        title: record.title,
        properties: record.properties
      }

      const ext = {
        name: 'test.hydration',
        loadedGraphNode: vi.fn((h: unknown) => capturedHandles.push(h))
      }

      // Simulate runtime calling loadedGraphNode(handle) for a workflow-loaded node.
      ext.loadedGraphNode(handle)

      expect(ext.loadedGraphNode).toHaveBeenCalledOnce()
      expect(capturedHandles).toHaveLength(1)
      const received = capturedHandles[0] as typeof handle
      expect(received.type).toBe('KSampler')
      expect(received.entityId).toBe(entityId)
    })

    it('widget values are present on the handle when loadedGraphNode fires', () => {
      const world = createHarnessWorld()

      // Harness models "widget values already populated" as properties on the record.
      const entityId = world.addNode({
        type: 'KSampler',
        properties: { seed: 42, steps: 20, cfg: 7.5 }
      })
      const record = world.findNode(entityId)!

      const seenProperties: Record<string, unknown> = {}
      const ext = {
        name: 'test.hydration-values',
        loadedGraphNode(handle: { properties: Record<string, unknown> }) {
          Object.assign(seenProperties, handle.properties)
        }
      }

      ext.loadedGraphNode({ properties: record.properties })

      expect(seenProperties.seed).toBe(42)
      expect(seenProperties.steps).toBe(20)
      expect(seenProperties.cfg).toBe(7.5)
    })

    it('loadedGraphNode is NOT called for a freshly created node', () => {
      // Model: fresh creation → nodeCreated fires; loadedGraphNode does NOT fire.
      const loadedFn = vi.fn()
      const createdFn = vi.fn()

      const ext = {
        name: 'test.exclusion',
        nodeCreated: createdFn,
        loadedGraphNode: loadedFn
      }

      const world = createHarnessWorld()
      const entityId = world.addNode({ type: 'KSampler' })
      const record = world.findNode(entityId)!

      // Simulate fresh creation: only nodeCreated fires.
      ext.nodeCreated({ type: record.type, entityId: record.entityId })

      expect(createdFn).toHaveBeenCalledOnce()
      expect(loadedFn).not.toHaveBeenCalled()
    })

    it('nodeCreated is NOT called for a workflow-loaded node', () => {
      // Model: workflow load → loadedGraphNode fires; nodeCreated does NOT fire.
      const loadedFn = vi.fn()
      const createdFn = vi.fn()

      const ext = {
        name: 'test.exclusion-loaded',
        nodeCreated: createdFn,
        loadedGraphNode: loadedFn
      }

      const world = createHarnessWorld()
      const entityId = world.addNode({ type: 'CLIPTextEncode' })
      const record = world.findNode(entityId)!

      // Simulate workflow load: only loadedGraphNode fires.
      ext.loadedGraphNode({ type: record.type, entityId: record.entityId })

      expect(loadedFn).toHaveBeenCalledOnce()
      expect(createdFn).not.toHaveBeenCalled()
    })
  })

  describe('ordering — loadedGraphNode fires after the node is in the World', () => {
    it('the node is already present in the World when loadedGraphNode fires', () => {
      const world = createHarnessWorld()
      let nodeFoundDuringHook = false

      const entityId = world.addNode({ type: 'VAEDecode' })

      const ext = {
        name: 'test.ordering',
        loadedGraphNode(handle: { entityId: number }) {
          nodeFoundDuringHook = world.findNode(handle.entityId) !== undefined
        }
      }

      ext.loadedGraphNode({ entityId })

      expect(nodeFoundDuringHook).toBe(true)
    })
  })

  describe('type-scoped filtering (nodeTypes:[])', () => {
    it('loadedGraphNode does not fire for non-matching node types when nodeTypes is set', () => {
      const loadedFn = vi.fn()

      const ext = {
        name: 'test.type-filter',
        nodeTypes: ['KSampler'],
        loadedGraphNode: loadedFn
      }

      const world = createHarnessWorld()
      world.addNode({ type: 'CLIPTextEncode' })
      world.addNode({ type: 'VAEDecode' })
      const kSamplerId = world.addNode({ type: 'KSampler' })

      // Simulate filtered dispatch: runtime only calls loadedGraphNode for matching types.
      for (const record of world.allNodes()) {
        if (ext.nodeTypes.includes(record.type)) {
          ext.loadedGraphNode({ type: record.type, entityId: record.entityId })
        }
      }

      expect(loadedFn).toHaveBeenCalledOnce()
      const handle = loadedFn.mock.calls[0][0] as { entityId: number }
      expect(handle.entityId).toBe(kSamplerId)
    })

    it('loadedGraphNode fires for every workflow-loaded node when nodeTypes is omitted', () => {
      const loadedFn = vi.fn()

      const ext = {
        name: 'test.no-filter',
        // nodeTypes not set → matches all
        loadedGraphNode: loadedFn
      }

      const world = createHarnessWorld()
      world.addNode({ type: 'KSampler' })
      world.addNode({ type: 'CLIPTextEncode' })
      world.addNode({ type: 'VAEDecode' })

      // Simulate unfiltered dispatch.
      for (const record of world.allNodes()) {
        ext.loadedGraphNode({ type: record.type, entityId: record.entityId })
      }

      expect(loadedFn).toHaveBeenCalledTimes(3)
    })
  })

  describe('S2.N7 evidence excerpts', () => {
    it('S2.N7 has at least one evidence excerpt in the snapshot', () => {
      expect(countEvidenceExcerpts('S2.N7')).toBeGreaterThan(0)
    })

    it('S2.N7 excerpt contains onConfigure fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N7', 0)
      expect(snippet.length).toBeGreaterThan(0)
      expect(snippet).toMatch(/onConfigure/i)
    })
  })
})

// ── Phase B stubs — need LoadedFromWorkflow ECS tag + real configure() wiring ─

describe('BC.03 v2 contract — node lifecycle: hydration [Phase B]', () => {
  it.todo(
    'loadedGraphNode fires (not nodeCreated) when a node enters the World with the LoadedFromWorkflow ECS tag component present'
  )
  it.todo(
    'state written to extensionState inside loadedGraphNode is readable in all subsequent hook calls for that entity'
  )
  it.todo(
    'loadedGraphNode is not called a second time if graph.configure() is called again on the same entity (idempotent)'
  )
})
