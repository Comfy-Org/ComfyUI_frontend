// Category: BC.21 — Custom widget-type registration
// DB cross-ref: S1.H2
// blast_radius: 4.32 — compat-floor: MUST pass before v2 ships
// Migration: v1 getCustomWidgets({ app }) factory → v2 defineWidgetExtension({ type, widgetCreated })
//
// Phase A: registration shape and widgetCreated contract equivalence.
// Runtime wiring (widgets appear in node after creation) is Phase B.
//
// I-TF.8 — BC.21 migration wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { WidgetExtensionOptions } from '@/extension-api/lifecycle'

// ── V1 app shim ───────────────────────────────────────────────────────────────

interface V1CustomWidget {
  type: string
  render: (container: HTMLElement) => void
}

interface V1Extension {
  name: string
  getCustomWidgets?(): Record<string, V1CustomWidget>
}

function createV1App() {
  const extensions: V1Extension[] = []
  const registeredWidgets: Map<string, V1CustomWidget> = new Map()

  return {
    registerExtension(ext: V1Extension) {
      extensions.push(ext)
      if (ext.getCustomWidgets) {
        const widgets = ext.getCustomWidgets()
        for (const [type, widget] of Object.entries(widgets)) {
          registeredWidgets.set(type, widget)
        }
      }
    },
    findWidget(type: string) { return registeredWidgets.get(type) },
    get widgetTypes() { return [...registeredWidgets.keys()] }
  }
}

// ── V2 registry shim ──────────────────────────────────────────────────────────

function createV2WidgetRegistry() {
  const extensions: WidgetExtensionOptions[] = []
  return {
    register(opts: WidgetExtensionOptions) { extensions.push(opts) },
    findByType(type: string) { return extensions.find((e) => e.type === type) },
    get widgetTypes() { return extensions.map((e) => e.type) }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.21 migration — custom widget-type registration', () => {
  describe('getCustomWidgets → defineWidgetExtension registration equivalence', () => {
    it('v1 getCustomWidgets and v2 defineWidgetExtension both make the widget type discoverable by type string', () => {
      const v1 = createV1App()
      const v2 = createV2WidgetRegistry()

      v1.registerExtension({
        name: 'bc21.mig.v1',
        getCustomWidgets() {
          return { MY_WIDGET: { type: 'MY_WIDGET', render() {} } }
        }
      })
      v2.register({ name: 'bc21.mig.v2', type: 'MY_WIDGET' })

      expect(v1.findWidget('MY_WIDGET')).toBeDefined()
      expect(v2.findByType('MY_WIDGET')).toBeDefined()
    })

    it('both v1 and v2 registrations produce distinct per-type entries — no type collision', () => {
      const v1 = createV1App()
      const v2 = createV2WidgetRegistry()

      const types = ['WIDGET_A', 'WIDGET_B', 'WIDGET_C']
      for (const type of types) {
        v1.registerExtension({
          name: `bc21.mig.v1.${type}`,
          getCustomWidgets() { return { [type]: { type, render() {} } } }
        })
        v2.register({ name: `bc21.mig.v2.${type}`, type })
      }

      expect(v1.widgetTypes.sort()).toEqual(types.sort())
      expect(v2.widgetTypes.sort()).toEqual(types.sort())
    })
  })

  describe('widgetCreated callback contract', () => {
    it('v2 widgetCreated fires once per widget instance, matching v1 factory invocation semantics', () => {
      const v2Created = vi.fn()
      const opts: WidgetExtensionOptions = {
        name: 'bc21.mig.per-instance',
        type: 'COUNTER_WIDGET',
        widgetCreated: v2Created
      }

      // Simulate runtime calling widgetCreated for 3 widget instances of this type.
      const stubs = [1, 2, 3].map((i) => ({
        entityId: i as WidgetExtensionOptions['name'] extends string ? number : never,
        name: `counter_${i}`,
        widgetType: 'COUNTER_WIDGET'
      }))
      for (const stub of stubs) {
        opts.widgetCreated!(stub as never, null)
      }

      expect(v2Created).toHaveBeenCalledTimes(3)
    })

    it('v2 widgetCreated returning { render, destroy } has equivalent lifecycle to v1 render + cleanup', () => {
      const renderFn = vi.fn()
      const destroyFn = vi.fn()

      const opts: WidgetExtensionOptions = {
        name: 'bc21.mig.lifecycle',
        type: 'LIFECYCLE_WIDGET',
        widgetCreated() { return { render: renderFn, destroy: destroyFn } }
      }

      const result = opts.widgetCreated!(
        { entityId: 1, name: 'w', widgetType: 'LIFECYCLE_WIDGET' } as never,
        null
      ) as { render(el: HTMLElement): void; destroy?(): void }

      const container = document.createElement('div')
      result.render(container)
      expect(renderFn).toHaveBeenCalledWith(container)

      result.destroy?.()
      expect(destroyFn).toHaveBeenCalledOnce()
    })
  })

  describe('[gap] runtime wiring — Phase B', () => {
    it.todo(
      '[gap] v2 widgetCreated is not yet called by the Phase A runtime — no live EffectScope wiring for widget extensions. ' +
      'Phase B: wire defineWidgetExtension into the extension service so widgetCreated fires for each live widget instance.'
    )
    it.todo(
      '[gap] v1 getCustomWidgets fires during extension setup (app ready); v2 defineWidgetExtension should register before nodeCreated fires. ' +
      'Phase B: confirm ordering guarantee in extensionV2Service.'
    )
    it.todo(
      '[gap] v1 custom widget type persists in LiteGraph after extension unloads; v2 type should be removed on dispose. ' +
      'Phase B: scope cleanup for WidgetExtensionOptions instances.'
    )
  })
})
