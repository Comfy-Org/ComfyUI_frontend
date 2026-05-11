// Category: BC.37 — VueNode bridge timing — deferred mount access
// DB cross-ref: S4.W5
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/load3d.ts
// blast_radius: 3.20
// compat-floor: blast_radius ≥ 2.0
// v1 contract: waitForLoad3d(node, callback) — deferred init pattern
//              nodeCreated fires before Vue component mounts; DOM widget value/callback/name are
//              LiteGraph-side only at nodeCreated time

import { describe, expect, it, vi } from 'vitest'

// Synthetic v1 node representing the LiteGraph side at nodeCreated time
function makeSyntheticNode() {
  return {
    id: 7,
    type: 'Load3D',
    widgets: [
      { name: 'model_file', value: 'scene.glb', callback: null as ((v: string) => void) | null },
    ],
    // Vue component instance — null until mount
    _vueComponent: null as Record<string, unknown> | null,
    // DOM element — null until Vue mounts
    _domElement: null as HTMLElement | null,
    // Removal flag
    _removed: false,
  }
}

// Minimal synthetic waitForLoad3d — polls until _vueComponent is non-null
function waitForLoad3d(
  node: ReturnType<typeof makeSyntheticNode>,
  callback: (comp: Record<string, unknown>) => void,
  intervalMs = 0,
) {
  const id = setInterval(() => {
    if (node._removed) {
      clearInterval(id)
      return
    }
    if (node._vueComponent !== null) {
      clearInterval(id)
      callback(node._vueComponent)
    }
  }, intervalMs)
  return id
}

describe('BC.37 v1 contract — VueNode bridge timing (deferred mount access)', () => {
  describe('S4.W5 — nodeCreated timing vs Vue mount', () => {
    it('at nodeCreated time, LiteGraph-side widget name and value are available', () => {
      const node = makeSyntheticNode()
      // nodeCreated fires here — synchronously after node construction
      const w = node.widgets[0]
      expect(w.name).toBe('model_file')
      expect(w.value).toBe('scene.glb')
    })

    it('at nodeCreated time, Vue component instance and DOM element are null', () => {
      const node = makeSyntheticNode()
      // This is the documented v1 footgun: _vueComponent is null at nodeCreated
      expect(node._vueComponent).toBeNull()
      expect(node._domElement).toBeNull()
    })

    it('widget callback can be assigned at nodeCreated — it fires later when value changes', () => {
      const node = makeSyntheticNode()
      const callbackValues: string[] = []

      // v1 pattern: assign callback at nodeCreated (LiteGraph side only)
      node.widgets[0].callback = (v) => callbackValues.push(v)

      // Simulate a value change (LiteGraph calls the callback)
      node.widgets[0].value = 'updated.glb'
      node.widgets[0].callback?.('updated.glb')

      expect(callbackValues).toEqual(['updated.glb'])
      // Vue props/emits are still not available
      expect(node._vueComponent).toBeNull()
    })
  })

  describe('S4.W5 — waitForLoad3d deferred init pattern', () => {
    it('waitForLoad3d invokes callback once _vueComponent becomes non-null', () =>
      new Promise<void>((resolve) => {
        vi.useFakeTimers()
        const node = makeSyntheticNode()
        const received: Record<string, unknown>[] = []

        waitForLoad3d(node, (comp) => {
          received.push(comp)
          vi.useRealTimers()
          expect(received).toHaveLength(1)
          expect(received[0]).toHaveProperty('renderer')
          resolve()
        }, 10)

        // Simulate Vue mount completing after two ticks
        setTimeout(() => {
          node._vueComponent = { renderer: 'WebGLRenderer', scene: 'Scene' }
        }, 20)

        vi.advanceTimersByTime(30)
      }))

    it('callback receives the exact _vueComponent object that was set', () =>
      new Promise<void>((resolve) => {
        vi.useFakeTimers()
        const node = makeSyntheticNode()
        const mockComp = { renderer: 'mock', getCanvas: () => null }

        waitForLoad3d(node, (comp) => {
          vi.useRealTimers()
          expect(comp).toBe(mockComp)
          resolve()
        }, 10)

        setTimeout(() => { node._vueComponent = mockComp }, 15)
        vi.advanceTimersByTime(20)
      }))

    it('if node is removed before mount, waitForLoad3d does not invoke the callback', () =>
      new Promise<void>((resolve) => {
        vi.useFakeTimers()
        const node = makeSyntheticNode()
        const received: unknown[] = []

        waitForLoad3d(node, (comp) => received.push(comp), 10)

        // Node is removed before Vue mounts
        node._removed = true

        // Even if _vueComponent is set after removal, callback must not fire
        setTimeout(() => { node._vueComponent = { renderer: 'too-late' } }, 20)

        vi.advanceTimersByTime(50)
        vi.useRealTimers()
        expect(received).toHaveLength(0)
        resolve()
      }))
  })
})
