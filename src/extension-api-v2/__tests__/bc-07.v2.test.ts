// Category: BC.07 — Connection observation, intercept, and veto
// DB cross-ref: S2.N3, S2.N12, S2.N13
// Exemplar: https://github.com/rgthree/rgthree-comfy/blob/main/web/comfyui/node_mode_relay.js#L90
// blast_radius: 5.46 — compat-floor: MUST pass before v2 ships
// v2 replacement: node.on('connected', handler), node.on('disconnected', handler)
//
// Phase A strategy: prove the registration contract (on() returns Unsubscribe,
// unsubscribe stops future calls, multiple listeners are independent) using a
// minimal typed event emitter that mirrors the service contract without the ECS
// dependency. Event-firing from real World mutations is marked todo(Phase B).
//
// I-TF.8.C1 — BC.07 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type {
  NodeConnectedEvent,
  NodeDisconnectedEvent,
  SlotEntityId,
  NodeEntityId,
  SlotDirection
} from '@/extension-api/node'
import type { Unsubscribe } from '@/extension-api/events'

// ── Minimal typed event emitter ───────────────────────────────────────────────
// Models the service's node.on() registration contract without ECS.
// The real service wires these to Vue watch() calls on World components (Phase B).

type SupportedEvent = 'connected' | 'disconnected'

interface HandlerEntry<E> {
  handler: (event: E) => void
  unsub: Unsubscribe
}

function createNodeEventBus() {
  const connectedHandlers: HandlerEntry<NodeConnectedEvent>[] = []
  const disconnectedHandlers: HandlerEntry<NodeDisconnectedEvent>[] = []

  function on(event: 'connected', handler: (e: NodeConnectedEvent) => void): Unsubscribe
  function on(event: 'disconnected', handler: (e: NodeDisconnectedEvent) => void): Unsubscribe
  function on(event: SupportedEvent, handler: (e: never) => void): Unsubscribe {
    if (event === 'connected') {
      const entry: HandlerEntry<NodeConnectedEvent> = {
        handler: handler as (e: NodeConnectedEvent) => void,
        unsub: () => {
          const idx = connectedHandlers.indexOf(entry)
          if (idx !== -1) connectedHandlers.splice(idx, 1)
        }
      }
      connectedHandlers.push(entry)
      return entry.unsub
    } else {
      const entry: HandlerEntry<NodeDisconnectedEvent> = {
        handler: handler as (e: NodeDisconnectedEvent) => void,
        unsub: () => {
          const idx = disconnectedHandlers.indexOf(entry)
          if (idx !== -1) disconnectedHandlers.splice(idx, 1)
        }
      }
      disconnectedHandlers.push(entry)
      return entry.unsub
    }
  }

  function emitConnected(event: NodeConnectedEvent) {
    for (const { handler } of [...connectedHandlers]) handler(event)
  }

  function emitDisconnected(event: NodeDisconnectedEvent) {
    for (const { handler } of [...disconnectedHandlers]) handler(event)
  }

  return { on, emitConnected, emitDisconnected }
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeSlotId(n: number) { return n as unknown as SlotEntityId }
function makeNodeId(n: number) { return n as unknown as NodeEntityId }

function makeSlot(name: string, dir: SlotDirection, nodeId = makeNodeId(1)) {
  return {
    entityId: makeSlotId(Math.random() * 1e9 | 0),
    name,
    type: 'IMAGE',
    direction: dir,
    nodeEntityId: nodeId
  } as const
}

function makeConnectedEvent(localName = 'input', remoteName = 'output'): NodeConnectedEvent {
  return {
    slot: makeSlot(localName, 'input'),
    remote: makeSlot(remoteName, 'output', makeNodeId(2))
  }
}

function makeDisconnectedEvent(slotName = 'input'): NodeDisconnectedEvent {
  return { slot: makeSlot(slotName, 'input') }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.07 v2 contract — connection observation', () => {
  describe('node.on("connected") — registration shape', () => {
    it('on("connected", fn) returns an Unsubscribe function', () => {
      const bus = createNodeEventBus()
      const unsub = bus.on('connected', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('registered handler is called when a connected event fires', () => {
      const bus = createNodeEventBus()
      const handler = vi.fn()
      bus.on('connected', handler)
      bus.emitConnected(makeConnectedEvent())
      expect(handler).toHaveBeenCalledOnce()
    })

    it('handler receives a NodeConnectedEvent with slot and remote fields', () => {
      const bus = createNodeEventBus()
      let received: NodeConnectedEvent | undefined
      bus.on('connected', (e) => { received = e })
      const evt = makeConnectedEvent('image_in', 'image_out')
      bus.emitConnected(evt)
      expect(received).toBeDefined()
      expect(received!.slot.name).toBe('image_in')
      expect(received!.remote.name).toBe('image_out')
      expect(received!.slot.direction).toBe('input')
      expect(received!.remote.direction).toBe('output')
    })

    it('calling Unsubscribe prevents future connected events from reaching the handler', () => {
      const bus = createNodeEventBus()
      const handler = vi.fn()
      const unsub = bus.on('connected', handler)
      bus.emitConnected(makeConnectedEvent())
      expect(handler).toHaveBeenCalledOnce()
      unsub()
      bus.emitConnected(makeConnectedEvent())
      expect(handler).toHaveBeenCalledOnce() // no new call
    })

    it('calling Unsubscribe twice is safe (idempotent)', () => {
      const bus = createNodeEventBus()
      const unsub = bus.on('connected', vi.fn())
      expect(() => { unsub(); unsub() }).not.toThrow()
    })

    it('multiple handlers all fire; unsubscribing one does not affect the others', () => {
      const bus = createNodeEventBus()
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      const handlerC = vi.fn()
      const unsubA = bus.on('connected', handlerA)
      bus.on('connected', handlerB)
      bus.on('connected', handlerC)

      bus.emitConnected(makeConnectedEvent())
      expect(handlerA).toHaveBeenCalledOnce()
      expect(handlerB).toHaveBeenCalledOnce()
      expect(handlerC).toHaveBeenCalledOnce()

      unsubA()
      bus.emitConnected(makeConnectedEvent())
      expect(handlerA).toHaveBeenCalledOnce() // still just once
      expect(handlerB).toHaveBeenCalledTimes(2)
      expect(handlerC).toHaveBeenCalledTimes(2)
    })
  })

  describe('node.on("disconnected") — registration shape', () => {
    it('on("disconnected", fn) returns an Unsubscribe function', () => {
      const bus = createNodeEventBus()
      const unsub = bus.on('disconnected', () => {})
      expect(typeof unsub).toBe('function')
    })

    it('handler receives a NodeDisconnectedEvent with a slot field', () => {
      const bus = createNodeEventBus()
      let received: NodeDisconnectedEvent | undefined
      bus.on('disconnected', (e) => { received = e })
      const evt = makeDisconnectedEvent('latent_in')
      bus.emitDisconnected(evt)
      expect(received).toBeDefined()
      expect(received!.slot.name).toBe('latent_in')
    })

    it('Unsubscribe prevents future disconnected events', () => {
      const bus = createNodeEventBus()
      const handler = vi.fn()
      const unsub = bus.on('disconnected', handler)
      bus.emitDisconnected(makeDisconnectedEvent())
      unsub()
      bus.emitDisconnected(makeDisconnectedEvent())
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('connected vs disconnected isolation', () => {
    it('connected listener does not fire on disconnected events', () => {
      const bus = createNodeEventBus()
      const connectedFn = vi.fn()
      const disconnectedFn = vi.fn()
      bus.on('connected', connectedFn)
      bus.on('disconnected', disconnectedFn)

      bus.emitDisconnected(makeDisconnectedEvent())
      expect(connectedFn).not.toHaveBeenCalled()
      expect(disconnectedFn).toHaveBeenCalledOnce()

      bus.emitConnected(makeConnectedEvent())
      expect(connectedFn).toHaveBeenCalledOnce()
      expect(disconnectedFn).toHaveBeenCalledOnce()
    })
  })
})

// ── Phase B stubs — need real ECS World + reactive dispatch ───────────────────

describe('BC.07 v2 contract — connection observation [Phase B]', () => {
  it.todo(
    '[Phase B] node.on("connected") fires when a real link is added to the World via ECS command'
  )
  it.todo(
    '[Phase B] node.on("disconnected") fires when a link is removed from the World'
  )
  it.todo(
    '[Phase B] handler registered via on() is removed by scope.stop() (onScopeDispose integration)'
  )
  it.todo(
    '[Phase B] veto/intercept: returning false from connectInput handler prevents the link from being wired (if adopted in Phase B API)'
  )
  it.todo(
    '[Phase B] type coercion: mutating event type inside a connection handler is reflected in the wired link'
  )
})
