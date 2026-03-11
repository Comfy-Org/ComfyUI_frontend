/**
 * Group Scope Invariant Tests
 *
 * Verifies that LGraphGroup geometry and state remain legacy-owned
 * (LiteGraph-authoritative) and are not partially centralized in
 * the layout store domain.
 *
 * Decision record: temp/node-layout-ssot-group-scope.md
 */
import { describe, expect, it } from 'vitest'

import { LGraph, LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutOperation } from '@/renderer/core/layout/types'

describe('LGraphGroup scope invariants', () => {
  describe('layout store exclusion boundary', () => {
    it('layoutStore operation types do not include group operations', () => {
      const nodeOperationTypes: LayoutOperation['type'][] = [
        'moveNode',
        'resizeNode',
        'setNodeZIndex',
        'createNode',
        'deleteNode',
        'setNodeVisibility',
        'batchUpdateBounds',
        'createLink',
        'deleteLink',
        'createReroute',
        'deleteReroute',
        'moveReroute'
      ]

      for (const opType of nodeOperationTypes) {
        expect(opType).not.toContain('group')
        expect(opType).not.toContain('Group')
      }
    })

    it('layoutStore has no group-related public methods', () => {
      const storeKeys = Object.getOwnPropertyNames(
        Object.getPrototypeOf(layoutStore)
      )

      const groupMethods = storeKeys.filter(
        (key) => key.toLowerCase().includes('group') && key !== 'constructor'
      )

      expect(groupMethods).toEqual([])
    })
  })

  describe('group geometry remains self-contained', () => {
    it('group move does not interact with layoutStore', () => {
      const group = new LGraphGroup('test')
      group.pos = [100, 200]

      const initialPos = [...group.pos]
      group.move(50, 30)

      expect(group.pos[0]).toBe(initialPos[0] + 50)
      expect(group.pos[1]).toBe(initialPos[1] + 30)
    })

    it('group resize does not interact with layoutStore', () => {
      const group = new LGraphGroup('test')
      group.size = [300, 200]

      expect(group.resize(400, 300)).toBe(true)
      expect(group.size[0]).toBe(400)
      expect(group.size[1]).toBe(300)
    })

    it('group serialization round-trips without store involvement', () => {
      const group = new LGraphGroup('Round Trip', 42)
      group.pos = [150, 250]
      group.size = [500, 400]
      group.color = '#f00'
      group.font_size = 32

      const serialized = group.serialize()
      const restored = new LGraphGroup()
      restored.configure(serialized)

      expect(restored.id).toBe(42)
      expect(restored.title).toBe('Round Trip')
      expect(restored.pos[0]).toBe(150)
      expect(restored.pos[1]).toBe(250)
      expect(restored.size[0]).toBe(500)
      expect(restored.size[1]).toBe(400)
      expect(restored.color).toBe('#f00')
      expect(restored.font_size).toBe(32)
    })
  })

  describe('group lifecycle is graph-owned', () => {
    it('graph.add(group) does not create layoutStore entries', () => {
      layoutStore.initializeFromLiteGraph([])
      const graph = new LGraph()
      const group = new LGraphGroup('test')
      group.pos = [0, 0]
      group.size = [200, 200]

      graph.add(group)

      const allNodes = layoutStore.getAllNodes()
      expect(allNodes.value.size).toBe(0)
    })

    it('graph.remove(group) does not affect layoutStore', () => {
      layoutStore.initializeFromLiteGraph([])
      const graph = new LGraph()
      const group = new LGraphGroup('test')
      graph.add(group)

      graph.remove(group)

      const allNodes = layoutStore.getAllNodes()
      expect(allNodes.value.size).toBe(0)
    })

    it('pinned group prevents move without store involvement', () => {
      const group = new LGraphGroup('pinned test')
      group.pos = [100, 100]
      group.pin(true)

      group.move(50, 50)

      expect(group.pos[0]).toBe(100)
      expect(group.pos[1]).toBe(100)
    })

    it('pinned group prevents resize without store involvement', () => {
      const group = new LGraphGroup('pinned test')
      group.size = [300, 200]
      group.pin(true)

      expect(group.resize(500, 400)).toBe(false)
      expect(group.size[0]).toBe(300)
      expect(group.size[1]).toBe(200)
    })
  })
})
