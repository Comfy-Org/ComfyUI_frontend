// Category: BC.33 — Cross-extension DOM widget creation observation
// DB cross-ref: S4.W6
// Exemplar: https://github.com/goodtab/ComfyUI-Custom-Scripts
// blast_radius: 0.0
// compat-floor: NO (absent API gap — this is a new v2 API surface)
// v2 contract: comfyApp.on('domWidgetCreated', (widgetHandle) => { ... })
//              fires for every DOM widget created by any extension

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Minimal event bus (models comfyApp event subscription) ───────────────────

type Handler<T> = (payload: T) => void
type Unsubscribe = () => void

function makeEventBus<Events extends Record<string, unknown>>() {
  const registry = new Map<keyof Events, Set<Handler<unknown>>>()

  return {
    on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
      if (!registry.has(event)) registry.set(event, new Set())
      registry.get(event)!.add(handler as Handler<unknown>)
      return () => registry.get(event)?.delete(handler as Handler<unknown>)
    },
    off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
      registry.get(event)?.delete(handler as Handler<unknown>)
    },
    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
      registry.get(event)?.forEach((fn) => fn(payload))
    },
    listenerCount<K extends keyof Events>(event: K): number {
      return registry.get(event)?.size ?? 0
    }
  }
}

// ── Widget + Node handle stubs ────────────────────────────────────────────────

interface NodeHandle {
  entityId: string
  type: string
}

interface WidgetHandle {
  entityId: string
  name: string
  type: string
  parentNode: NodeHandle | null
}

interface AppEvents {
  domWidgetCreated: WidgetHandle
}

function makeWidget(overrides: Partial<WidgetHandle> = {}): WidgetHandle {
  return {
    entityId: 'widget:test:1',
    name: 'slider_value',
    type: 'Slider',
    parentNode: { entityId: 'node:test:1', type: 'KSampler' },
    ...overrides
  }
}

// ─────────────────────────────────────────────────────────────────────────────

describe('BC.33 v2 contract — cross-extension DOM widget creation observation', () => {
  let app: ReturnType<typeof makeEventBus<AppEvents>>

  beforeEach(() => {
    app = makeEventBus<AppEvents>()
  })

  describe("S4.W6 — domWidgetCreated event", () => {
    it("on('domWidgetCreated', handler) registers a listener that fires for every DOM widget created", () => {
      const received: WidgetHandle[] = []
      app.on('domWidgetCreated', (w) => received.push(w))

      const w1 = makeWidget({ entityId: 'widget:1', name: 'alpha' })
      const w2 = makeWidget({ entityId: 'widget:2', name: 'beta' })
      app.emit('domWidgetCreated', w1)
      app.emit('domWidgetCreated', w2)

      expect(received).toHaveLength(2)
      expect(received[0].name).toBe('alpha')
      expect(received[1].name).toBe('beta')
    })

    it('handler receives a WidgetHandle with type, name, and owning NodeHandle accessible', () => {
      let captured: WidgetHandle | null = null
      app.on('domWidgetCreated', (w) => { captured = w })

      const widget = makeWidget({
        name: 'cfg',
        type: 'Slider',
        parentNode: { entityId: 'node:test:99', type: 'KSampler' }
      })
      app.emit('domWidgetCreated', widget)

      expect(captured).not.toBeNull()
      expect(captured!.name).toBe('cfg')
      expect(captured!.type).toBe('Slider')
      expect(captured!.parentNode?.type).toBe('KSampler')
    })

    it('domWidgetCreated fires for widgets created by other extensions, not just the registering one', () => {
      // Two "extensions": ext-A registers the listener, ext-B creates the widget
      const extA_received: WidgetHandle[] = []
      app.on('domWidgetCreated', (w) => extA_received.push(w)) // ext-A listener

      // ext-B creates a widget and the runtime emits the event
      const extBWidget = makeWidget({ entityId: 'widget:ext-b:1', name: 'ext_b_param' })
      app.emit('domWidgetCreated', extBWidget) // runtime emits after ext-B creates it

      expect(extA_received).toHaveLength(1)
      expect(extA_received[0].entityId).toBe('widget:ext-b:1')
    })

    it('listener registered before any node is created receives events for all subsequently created DOM widgets', () => {
      const log: string[] = []
      app.on('domWidgetCreated', (w) => log.push(w.entityId)) // registered early

      // Widgets created later
      for (let i = 1; i <= 5; i++) {
        app.emit('domWidgetCreated', makeWidget({ entityId: `widget:${i}` }))
      }

      expect(log).toHaveLength(5)
      expect(log).toEqual(['widget:1', 'widget:2', 'widget:3', 'widget:4', 'widget:5'])
    })
  })

  describe("S4.W6 — handler cleanup", () => {
    it("off('domWidgetCreated', handler) unregisters the listener without affecting other listeners", () => {
      const aLog: string[] = []
      const bLog: string[] = []

      const handlerA = (w: WidgetHandle) => aLog.push(w.name)
      const handlerB = (w: WidgetHandle) => bLog.push(w.name)

      app.on('domWidgetCreated', handlerA)
      app.on('domWidgetCreated', handlerB)

      app.emit('domWidgetCreated', makeWidget({ name: 'first' }))
      expect(aLog).toHaveLength(1)
      expect(bLog).toHaveLength(1)

      app.off('domWidgetCreated', handlerA) // remove only A

      app.emit('domWidgetCreated', makeWidget({ name: 'second' }))
      expect(aLog).toHaveLength(1) // A stopped receiving
      expect(bLog).toHaveLength(2) // B still receives
    })

    it('unsubscribe() returned from on() removes the listener', () => {
      const log: string[] = []
      const unsub = app.on('domWidgetCreated', (w) => log.push(w.name))

      app.emit('domWidgetCreated', makeWidget({ name: 'before' }))
      unsub()
      app.emit('domWidgetCreated', makeWidget({ name: 'after' }))

      expect(log).toEqual(['before'])
    })
  })
})
