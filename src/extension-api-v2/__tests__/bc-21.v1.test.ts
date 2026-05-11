// Category: BC.21 — Custom widget-type registration
// DB cross-ref: S1.H2
// Exemplar: https://github.com/Comfy-Org/ComfyUI_frontend/blob/main/src/extensions/core/
// blast_radius: 4.32
// compat-floor: blast_radius ≥ 2.0
// v1 contract: app.registerExtension({ getCustomWidgets(app) { return { MYWIDGET: (node, inputData, app) => ({ widget: ... }) } } })

import { describe, expect, it, vi } from 'vitest'

// ── Minimal custom-widget registration shim ───────────────────────────────────

interface V1Widget { name: string; value: unknown; type: string }
interface V1NodeStub { widgets: V1Widget[]; type: string }

type WidgetFactory = (node: V1NodeStub, inputData: unknown[], app: unknown) => { widget: V1Widget }

function createWidgetRegistry() {
  const factories = new Map<string, WidgetFactory>()
  const extensions: { getCustomWidgets?: (app: unknown) => Record<string, WidgetFactory> }[] = []

  const api = {
    registerExtension(ext: (typeof extensions)[0]) {
      extensions.push(ext)
    },
    initWidgetTypes() {
      for (const ext of extensions) {
        const widgets = ext.getCustomWidgets?.(api) ?? {}
        for (const [type, factory] of Object.entries(widgets)) {
          factories.set(type, factory)
        }
      }
    },
    createWidget(type: string, node: V1NodeStub, inputData: unknown[]): V1Widget | undefined {
      const factory = factories.get(type)
      if (!factory) return undefined
      const result = factory(node, inputData, api)
      node.widgets.push(result.widget)
      return result.widget
    },
    hasType(type: string) {
      return factories.has(type)
    }
  }
  return api
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.21 v1 contract — Custom widget-type registration', () => {
  describe('S1.H2 — getCustomWidgets hook (synthetic)', () => {
    it('extension returning a widget factory from getCustomWidgets registers the type globally', () => {
      const registry = createWidgetRegistry()

      registry.registerExtension({
        getCustomWidgets() {
          return {
            MYWIDGET: (_node, _inputData, _app) => ({
              widget: { name: 'my_widget', value: '', type: 'MYWIDGET' }
            })
          }
        }
      })

      registry.initWidgetTypes()

      expect(registry.hasType('MYWIDGET')).toBe(true)
    })

    it('registered widget factory is invoked with (node, inputData, app) when a node with that input type is created', () => {
      const registry = createWidgetRegistry()
      const factoryCalls: unknown[][] = []

      registry.registerExtension({
        getCustomWidgets(app) {
          return {
            TRACKER: (node, inputData, a) => {
              factoryCalls.push([node, inputData, a])
              return { widget: { name: 'tracker', value: 0, type: 'TRACKER' } }
            }
          }
        }
      })

      registry.initWidgetTypes()

      const node: V1NodeStub = { widgets: [], type: 'TrackerNode' }
      registry.createWidget('TRACKER', node, [['TRACKER', {}]])

      expect(factoryCalls).toHaveLength(1)
      expect(factoryCalls[0][0]).toBe(node)
    })

    it('widget returned by factory is attached to node.widgets array', () => {
      const registry = createWidgetRegistry()

      registry.registerExtension({
        getCustomWidgets() {
          return {
            SLIDER: (_node, _inputData, _app) => ({
              widget: { name: 'strength', value: 0.5, type: 'SLIDER' }
            })
          }
        }
      })

      registry.initWidgetTypes()

      const node: V1NodeStub = { widgets: [], type: 'SliderNode' }
      const widget = registry.createWidget('SLIDER', node, [])

      expect(node.widgets).toHaveLength(1)
      expect(node.widgets[0]).toBe(widget)
    })

    it('two extensions registering distinct widget types do not collide', () => {
      const registry = createWidgetRegistry()

      registry.registerExtension({
        getCustomWidgets() {
          return {
            WIDGET_A: (_n, _i, _a) => ({ widget: { name: 'w_a', value: '', type: 'WIDGET_A' } })
          }
        }
      })

      registry.registerExtension({
        getCustomWidgets() {
          return {
            WIDGET_B: (_n, _i, _a) => ({ widget: { name: 'w_b', value: '', type: 'WIDGET_B' } })
          }
        }
      })

      registry.initWidgetTypes()

      expect(registry.hasType('WIDGET_A')).toBe(true)
      expect(registry.hasType('WIDGET_B')).toBe(true)

      const nodeA: V1NodeStub = { widgets: [], type: 'NodeA' }
      const nodeB: V1NodeStub = { widgets: [], type: 'NodeB' }
      registry.createWidget('WIDGET_A', nodeA, [])
      registry.createWidget('WIDGET_B', nodeB, [])

      expect(nodeA.widgets[0].type).toBe('WIDGET_A')
      expect(nodeB.widgets[0].type).toBe('WIDGET_B')
    })

    it('registering the same widget type key twice: second registration wins (last-write semantics)', () => {
      const registry = createWidgetRegistry()

      registry.registerExtension({
        getCustomWidgets() {
          return {
            SHARED: (_n, _i, _a) => ({ widget: { name: 'first', value: 1, type: 'SHARED' } })
          }
        }
      })

      registry.registerExtension({
        getCustomWidgets() {
          return {
            SHARED: (_n, _i, _a) => ({ widget: { name: 'second', value: 2, type: 'SHARED' } })
          }
        }
      })

      registry.initWidgetTypes()

      const node: V1NodeStub = { widgets: [], type: 'X' }
      const widget = registry.createWidget('SHARED', node, [])

      // Last writer wins — second registration's factory was used
      expect(widget?.name).toBe('second')
    })
  })

  describe('Phase B deferred', () => {
    it.todo(
      'custom widget type integrates with PrimeVue component rendering — requires Vue runtime (Phase B)'
    )
  })
})
