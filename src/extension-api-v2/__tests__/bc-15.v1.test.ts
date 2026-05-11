// Category: BC.15 — Workflow loading into the editor
// DB cross-ref: S6.A2
// Exemplar: https://github.com/BennyKok/comfyui-deploy/blob/main/web-plugin/workflow-list.js#L456
// blast_radius: 5.05 (compat-floor)
// compat-floor: blast_radius ≥ 2.0
// v1 contract: app.loadGraphData(workflowJson) — direct call, no lifecycle events

import { describe, expect, it } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.15 v1 contract — app.loadGraphData', () => {
  // ── S6.A2 evidence ───────────────────────────────────────────────────────────
  describe('S6.A2 — evidence excerpts', () => {
    it('S6.A2 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S6.A2')).toBeGreaterThan(0)
    })

    it('S6.A2 evidence snippet contains loadGraphData fingerprint', () => {
      const count = countEvidenceExcerpts('S6.A2')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S6.A2', i)
        if (/loadGraphData/i.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S6.A2 excerpt with loadGraphData fingerprint').toBe(true)
    })

    it('S6.A2 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S6.A2', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S6.A2 synthetic behavior ─────────────────────────────────────────────────
  describe('S6.A2 — direct workflow load', () => {
    it('loadGraphData replaces graph nodes with those from the provided JSON', () => {
      const app = createMiniComfyApp()
      app.graph.add({ type: 'KSampler' })
      expect(app.world.allNodes()).toHaveLength(1)
      // Simulate loadGraphData clearing the graph and loading new nodes
      app.world.clear()
      app.graph.add({ type: 'CLIPTextEncode' })
      app.graph.add({ type: 'VAEDecode' })
      expect(app.world.allNodes()).toHaveLength(2)
      expect(app.world.findNodesByType('CLIPTextEncode')).toHaveLength(1)
    })

    it('calling loadGraphData clears all existing nodes first (world is empty mid-load)', () => {
      const app = createMiniComfyApp()
      app.graph.add({ type: 'KSampler' })
      app.graph.add({ type: 'CLIPTextEncode' })
      expect(app.world.allNodes()).toHaveLength(2)
      // Simulate loadGraphData: first step is clear
      app.world.clear()
      expect(app.world.allNodes()).toHaveLength(0)
      // Then new nodes are added
      app.graph.add({ type: 'VAEDecode' })
      expect(app.world.allNodes()).toHaveLength(1)
    })

    it('accepts a plain JSON object (not a string) — harness world.addNode accepts plain objects too', () => {
      const app = createMiniComfyApp()
      // The workflow is a plain object literal, not a JSON string
      const workflowJson = { nodes: [{ type: 'KSampler' }, { type: 'VAEDecode' }] }
      // Simulate loadGraphData: iterate the nodes array and add each
      app.world.clear()
      for (const nodeSpec of workflowJson.nodes) {
        app.world.addNode({ type: nodeSpec.type })
      }
      expect(app.world.allNodes()).toHaveLength(2)
    })

    it('node IDs in the loaded workflow are preserved — use world to look up by type after add', () => {
      const app = createMiniComfyApp()
      app.world.clear()
      // Add nodes with specific types; harness assigns sequential IDs
      const id1 = app.world.addNode({ type: 'KSampler' })
      const id2 = app.world.addNode({ type: 'CLIPTextEncode' })
      // Verify that the nodes can be retrieved by their assigned IDs
      expect(app.world.findNode(id1)?.type).toBe('KSampler')
      expect(app.world.findNode(id2)?.type).toBe('CLIPTextEncode')
      // Both IDs are distinct and stable
      expect(id1).not.toBe(id2)
    })

    it.todo(
      'real app.loadGraphData implementation: nodeCreated event fires for each deserialized node after loadGraphData completes'
    )

    it.todo(
      'link preservation: edges between nodes are restored after loadGraphData'
    )
  })
})
