// Category: BC.07 — Connection observation, intercept, and veto
// DB cross-ref: S2.N3, S2.N12, S2.N13
// Exemplar: https://github.com/rgthree/rgthree-comfy/blob/main/web/comfyui/node_mode_relay.js#L90
// Migration: v1 prototype patching (onConnectInput/onConnectOutput/onConnectionsChange)
//            → v2 node.on('connected') / node.on('disconnected')
//
// Phase A strategy: prove call-count parity between the two subscription styles
// using a synthetic event bus. Real graph-wiring and veto semantics need Phase B.
//
// I-TF.8.C1 — BC.07 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import { effectScope, onScopeDispose } from 'vue'
import type { NodeConnectedEvent, NodeDisconnectedEvent, NodeEntityId, SlotEntityId, SlotDirection } from '@/extension-api/node'
import type { Unsubscribe } from '@/extension-api/events'

// ── V1 shim: prototype-assignment style ──────────────────────────────────────
// Models the v1 pattern where extensions assign methods to an LGraphNode-like
// prototype or instance. The "app" calls them directly.

interface V1NodeLike {
  id: number
  type: string
  onConnectInput?: (slot: number, type: string) => boolean | void
  onConnectOutput?: (slot: number, type: string) => boolean | void
  onConnectionsChange?: (type: number, slot: number, connected: boolean) => void
}

function createV1App() {
  const nodes: V1NodeLike[] = []
  return {
    addNode(node: V1NodeLike) { nodes.push(node) },
    simulateConnectInput(nodeId: number, slot: number, type: string) {
      const node = nodes.find((n) => n.id === nodeId)
      return node?.onConnectInput?.(slot, type)
    },
    simulateConnectOutput(nodeId: number, slot: number, type: string) {
      const node = nodes.find((n) => n.id === nodeId)
      return node?.onConnectOutput?.(slot, type)
    },
    simulateConnectionsChange(nodeId: number, type: number, slot: number, connected: boolean) {
      const node = nodes.find((n) => n.id === nodeId)
      node?.onConnectionsChange?.(type, slot, connected)
    }
  }
}

// ── V2 shim: node.on() style ──────────────────────────────────────────────────

type EventName = 'connected' | 'disconnected'

function createV2NodeBus() {
  const connectedHandlers: Array<(e: NodeConnectedEvent) => void> = []
  const disconnectedHandlers: Array<(e: NodeDisconnectedEvent) => void> = []

  function on(event: 'connected', fn: (e: NodeConnectedEvent) => void): Unsubscribe
  function on(event: 'disconnected', fn: (e: NodeDisconnectedEvent) => void): Unsubscribe
  function on(event: EventName, fn: (e: never) => void): Unsubscribe {
    if (event === 'connected') {
      connectedHandlers.push(fn as (e: NodeConnectedEvent) => void)
      return () => {
        const i = connectedHandlers.indexOf(fn as (e: NodeConnectedEvent) => void)
        if (i !== -1) connectedHandlers.splice(i, 1)
      }
    }
    disconnectedHandlers.push(fn as (e: NodeDisconnectedEvent) => void)
    return () => {
      const i = disconnectedHandlers.indexOf(fn as (e: NodeDisconnectedEvent) => void)
      if (i !== -1) disconnectedHandlers.splice(i, 1)
    }
  }

  function emitConnected(e: NodeConnectedEvent) {
    for (const h of [...connectedHandlers]) h(e)
  }
  function emitDisconnected(e: NodeDisconnectedEvent) {
    for (const h of [...disconnectedHandlers]) h(e)
  }

  return { on, emitConnected, emitDisconnected, connectedHandlers, disconnectedHandlers }
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeSlot(name: string, dir: SlotDirection) {
  return {
    entityId: 1 as unknown as SlotEntityId,
    name,
    type: 'IMAGE',
    direction: dir,
    nodeEntityId: 1 as unknown as NodeEntityId
  } as const
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.07 migration — connection observation', () => {
  describe('onConnectionsChange (S2.N3) → on("connected") / on("disconnected")', () => {
    it('both v1 and v2 call their handlers the same number of times for the same events', () => {
      const v1App = createV1App()
      const bus = createV2NodeBus()
      let v1Count = 0
      let v2Count = 0

      // v1: assign method on node instance
      const node: V1NodeLike = {
        id: 1,
        type: 'KSampler',
        onConnectionsChange(_type, _slot, _connected) { v1Count++ }
      }
      v1App.addNode(node)

      // v2: register via on()
      bus.on('connected', () => { v2Count++ })
      bus.on('disconnected', () => { v2Count++ })

      // Simulate 2 connect + 1 disconnect
      v1App.simulateConnectionsChange(1, 1, 0, true)   // input connected
      v1App.simulateConnectionsChange(1, 0, 1, true)   // output connected
      v1App.simulateConnectionsChange(1, 0, 0, false)  // input disconnected

      bus.emitConnected({ slot: makeSlot('in', 'input'), remote: makeSlot('out', 'output') })
      bus.emitConnected({ slot: makeSlot('in2', 'input'), remote: makeSlot('out2', 'output') })
      bus.emitDisconnected({ slot: makeSlot('in', 'input') })

      expect(v2Count).toBe(v1Count)
      expect(v2Count).toBe(3)
    })

    it('v2 handler receives typed slot info; v1 received raw numeric slot index', () => {
      const bus = createV2NodeBus()
      let receivedSlotName: string | undefined

      bus.on('connected', (e) => {
        receivedSlotName = e.slot.name
      })

      bus.emitConnected({
        slot: makeSlot('latent', 'input'),
        remote: makeSlot('LATENT', 'output')
      })

      // v2 gives the slot name directly; v1 gave a numeric index that required
      // the extension to call node.inputs[slotIndex] to resolve the name.
      expect(receivedSlotName).toBe('latent')
    })
  })

  describe('onConnectInput / onConnectOutput (S2.N12, S2.N13) → on("connected")', () => {
    it('on("connected") fires once per link established, matching v1 onConnectInput call count', () => {
      const v1App = createV1App()
      const bus = createV2NodeBus()
      const v1Calls: number[] = []
      const v2Calls: string[] = []

      const node: V1NodeLike = {
        id: 2,
        type: 'TestNode',
        onConnectInput(slot) { v1Calls.push(slot) }
      }
      v1App.addNode(node)
      bus.on('connected', (e) => { v2Calls.push(e.slot.name) })

      // Simulate 2 input connections
      v1App.simulateConnectInput(2, 0, 'IMAGE')
      v1App.simulateConnectInput(2, 1, 'LATENT')
      bus.emitConnected({ slot: makeSlot('image', 'input'), remote: makeSlot('img_out', 'output') })
      bus.emitConnected({ slot: makeSlot('latent', 'input'), remote: makeSlot('lat_out', 'output') })

      expect(v2Calls).toHaveLength(v1Calls.length)
      expect(v2Calls).toHaveLength(2)
    })
  })

  describe('scope and cleanup', () => {
    it('v2 on() listener is removed when the EffectScope is stopped (v1 prototype patch persists)', () => {
      const bus = createV2NodeBus()
      const handler = vi.fn()

      // Mount in a scope
      const scope = effectScope()
      scope.run(() => {
        const unsub = bus.on('connected', handler)
        onScopeDispose(unsub)
      })

      bus.emitConnected({ slot: makeSlot('in', 'input'), remote: makeSlot('out', 'output') })
      expect(handler).toHaveBeenCalledOnce()

      // Stopping scope triggers onScopeDispose → unsub
      scope.stop()
      bus.emitConnected({ slot: makeSlot('in', 'input'), remote: makeSlot('out', 'output') })
      expect(handler).toHaveBeenCalledOnce() // no new call

      // v1 contrast: prototype methods have no scope — they leak until the node object is GC'd
    })

    it('unsubscribing one v2 listener does not affect other listeners on the same bus', () => {
      const bus = createV2NodeBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()

      const unsubA = bus.on('connected', handlerA)
      bus.on('connected', handlerB)

      bus.emitConnected({ slot: makeSlot('in', 'input'), remote: makeSlot('out', 'output') })
      unsubA()
      bus.emitConnected({ slot: makeSlot('in', 'input'), remote: makeSlot('out', 'output') })

      expect(handlerA).toHaveBeenCalledOnce()
      expect(handlerB).toHaveBeenCalledTimes(2)
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.07 migration — connection observation [Phase B]', () => {
  it.todo(
    '[Phase B] v1 onConnectInput returning false and v2 veto equivalent both leave the graph unwired'
  )
  it.todo(
    '[Phase B] type coercion in v1 onConnectInput matches type coercion in v2 connected handler'
  )
  it.todo(
    '[Phase B] v1 onConnectOutput veto and v2 equivalent both prevent connectionChange from firing on either endpoint'
  )
  it.todo(
    '[Phase B] v2 on("connected") fires at the same point in the link-wiring sequence as v1 onConnectionsChange (after graph mutation)'
  )
})
