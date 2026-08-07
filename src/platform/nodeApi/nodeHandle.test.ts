import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode } from '@/lib/litegraph/src/types/globalEnums'

import { ComfyDeletedError, ComfyReadonlyError } from './errors'
import { createGraphApi } from './graphHandle'
import { createNodeHandles } from './nodeHandle'
import type { NodeHandle } from './nodeHandle'

describe('NodeHandle', () => {
  let graph: LGraph
  let node: LGraphNode
  let handles: ReturnType<typeof createNodeHandles>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    graph = new LGraph()
    node = new LGraphNode('Test Title', 'TestNode')
    graph.add(node)
    handles = createNodeHandles(() => graph, {
      inputs: () => createGraphApi(() => graph).node(String(node.id))!.inputs,
      outputs: () => createGraphApi(() => graph).node(String(node.id))!.outputs,
      widgets: () => createGraphApi(() => graph).node(String(node.id))!.widgets
    })
  })

  const handle = () => handles.handleFor(String(node.id)) as NodeHandle

  describe('reads', () => {
    it('exposes identity and title', () => {
      expect(handle().id).toBe(String(node.id))
      expect(handle().type).toBe('TestNode')
      expect(handle().getTitle()).toBe('Test Title')
    })

    it('reads comfyClass as a string, not a bound method', () => {
      // Registered as a method it read back as a function, so every
      // `switch (node.comfyClass)` in a converted pack fell through in silence.
      ;(node as unknown as { comfyClass: string }).comfyClass = 'INTConstant'
      expect(handle().comfyClass).toBe('INTConstant')
    })

    it('falls back to the node type when there is no comfyClass', () => {
      expect(handle().comfyClass).toBe('TestNode')
    })

    it('maps internal mode enum to public strings', () => {
      expect(handle().getMode()).toBe('always')
      node.mode = LGraphEventMode.BYPASS
      expect(handle().getMode()).toBe('bypass')
    })

    it('reports flags as booleans, not undefined', () => {
      expect(handle().isCollapsed()).toBe(false)
      expect(handle().isPinned()).toBe(false)
    })

    it('returns frozen geometry so reads cannot be written through', () => {
      node.pos = [10, 20]
      const pos = handle().getPosition()
      expect(pos).toEqual({ x: 10, y: 20 })
      expect(Object.isFrozen(pos)).toBe(true)
    })
  })

  describe('writes', () => {
    it('writes title through to the node', () => {
      handle().setTitle('Renamed')
      expect(node.getTitle()).toBe('Renamed')
    })

    it('maps public mode strings back to the internal enum', () => {
      handle().setMode('never')
      expect(node.mode).toBe(LGraphEventMode.NEVER)
    })

    it('rejects an invalid mode loudly instead of silently ignoring', () => {
      expect(() => {
        handle().setMode('nonsense' as never)
      }).toThrow(/Invalid node mode/)
      expect(node.mode).toBe(LGraphEventMode.ALWAYS)
    })

    it('sets flags without clobbering sibling flags', () => {
      node.flags = { ...node.flags, pinned: true }
      handle().setCollapsed(true)
      expect(node.flags.collapsed).toBe(true)
      expect(node.flags.pinned).toBe(true)
    })

    it('round-trips shape through public names', () => {
      handle().setShape('card')
      expect(handle().getShape()).toBe('card')
    })

    it('rejects an invalid shape', () => {
      expect(() => {
        handle().setShape('hexagon' as never)
      }).toThrow(/Invalid node shape/)
    })

    it('refuses to change type, pointing at the replacement', () => {
      expect(() => {
        ;(handle() as { type: string }).type = 'Other'
      }).toThrow(ComfyReadonlyError)
      expect(() => {
        ;(handle() as { type: string }).type = 'Other'
      }).toThrow(/no published way to change it/)
      expect(node.type).toBe('TestNode')
    })

    it('moves and resizes via methods', () => {
      handle().setPosition({ x: 100, y: 200 })
      handle().setSize({ width: 300, height: 400 })
      expect([node.pos[0], node.pos[1]]).toEqual([100, 200])
      expect([node.size[0], node.size[1]]).toEqual([300, 400])
    })
  })

  describe('the real node is not reachable', () => {
    it('does not expose litegraph internals', () => {
      const h = handle() as unknown as Record<string, unknown>
      expect(h.graph).toBeUndefined()
      expect(h._state).toBeUndefined()
      expect(h.flags).toBeUndefined()
      expect(h.constructor).toBeUndefined()
      expect(Object.getPrototypeOf(h)).toBeNull()
    })

    it('exposes widgets as a closed collection, not the raw array', () => {
      const widgets = handle().widgets
      expect(Array.isArray(widgets)).toBe(false)
      expect(widgets).not.toBe(node.widgets)
      expect(typeof widgets.reorder).toBe('function')
    })

    it('has no property path from the handle to the LGraphNode', () => {
      const seen = new Set<unknown>()
      const reaches = (value: unknown, depth: number): boolean => {
        if (depth > 4 || value === null || typeof value !== 'object') {
          return false
        }
        if (value === node || value === graph) return true
        if (seen.has(value)) return false
        seen.add(value)
        return Object.values(value).some((v) => reaches(v, depth + 1))
      }
      expect(reaches(handle(), 0)).toBe(false)
    })

    it('yields an inert, cloneable snapshot', () => {
      const snap = handle().snapshot()
      expect(() => structuredClone(snap)).not.toThrow()
      expect(snap).toMatchObject({ type: 'TestNode', title: 'Test Title' })
    })
  })

  describe('lifetime', () => {
    it('is identity-stable for the same node', () => {
      expect(handle()).toBe(handle())
    })

    it('removes the node from the graph', () => {
      handle().remove()
      expect(graph.nodes).not.toContain(node)
    })

    it('reports isDeleted once the node is gone', () => {
      const held = handle()
      expect(held.isDeleted).toBe(false)
      graph.remove(node)
      expect(held.isDeleted).toBe(true)
    })

    it('keeps reads inert and mutations loud after deletion', () => {
      const held = handle()
      const id = held.id
      graph.remove(node)

      expect(held.id).toBe(id)
      expect(held.getTitle()).toBeUndefined()
      expect(held.getPosition()).toBeUndefined()
      expect(() => held.snapshot()).not.toThrow()
      expect(held.snapshot()).toBeUndefined()
      expect(() => held.setTitle('zombie')).toThrow(ComfyDeletedError)
    })

    it('makes idempotent cleanup on a dead handle harmless', () => {
      const held = handle()
      graph.remove(node)
      // Removing an already-removed node is the caller's desired end state, so
      // packs can run teardown unconditionally.
      expect(() => held.remove()).not.toThrow()
    })

    it('still refuses a write on a dead handle', () => {
      const held = handle()
      graph.remove(node)
      // A dropped write is a bug the pack cannot see. Setting is not
      // idempotent, so unlike removal it has to be loud.
      expect(() => held.setPosition({ x: 1, y: 2 })).toThrow(ComfyDeletedError)
      expect(() => held.setTitle('zombie')).toThrow(ComfyDeletedError)
    })

    it('liveHandleFor gates on current existence', () => {
      expect(handles.liveHandleFor(String(node.id))).toBeDefined()
      graph.remove(node)
      expect(handles.liveHandleFor(String(node.id))).toBeUndefined()
    })
  })
})
