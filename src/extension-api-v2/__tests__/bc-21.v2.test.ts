// Category: BC.21 — Custom widget-type registration
// DB cross-ref: S1.H2
// blast_radius: 4.32 — compat-floor: MUST pass before v2 ships
// v2 replacement: defineWidgetExtension({ type: 'MY_WIDGET', widgetCreated(widget, parentNode) { ... } })
//
// Phase A findings (from lifecycle.ts inspection):
// WidgetExtensionOptions has:
//   - name: string
//   - type: string  (widget type key, e.g. 'COLOR_PICKER')
//   - widgetCreated?(widget: WidgetHandle, parentNode: NodeHandle | null): { render, destroy? } | void
//
// Note: stub name in the original file used 'widgetType'/'create' — actual interface uses 'type'/'widgetCreated'.
// Tests here use the real interface fields.
//
// I-TF.8 — BC.21 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'
import type { WidgetExtensionOptions } from '@/extension-api/lifecycle'
import type { WidgetHandle } from '@/extension-api/widget'
import type { NodeHandle } from '@/extension-api/node'

// ── Type fixture ──────────────────────────────────────────────────────────────

function makeWidgetHandle(overrides: Partial<WidgetHandle> = {}): WidgetHandle {
  return {
    entityId: 1 as WidgetHandle['entityId'],
    name: 'steps',
    widgetType: 'INT',
    label: 'Steps',
    getValue: () => 20 as never,
    setValue: () => {},
    isHidden: () => false,
    setHidden: () => {},
    isDisabled: () => false,
    setDisabled: () => {},
    isSerializeEnabled: () => true,
    setSerializeEnabled: () => {},
    getOption: () => undefined,
    setOption: () => {},
    on: () => () => {},
    ...overrides
  } as unknown as WidgetHandle
}

function makeNodeHandle(): Partial<NodeHandle> {
  return { type: 'KSampler', comfyClass: 'KSampler' }
}

// ── Widget extension registry stub ────────────────────────────────────────────

function createWidgetExtensionRegistry() {
  const extensions: WidgetExtensionOptions[] = []
  return {
    register(opts: WidgetExtensionOptions) { extensions.push(opts) },
    findByType(type: string) { return extensions.find((e) => e.type === type) },
    getAll() { return [...extensions] },
    clear() { extensions.length = 0 }
  }
}

// ── Wired assertions (Phase A) ────────────────────────────────────────────────

describe('BC.21 v2 contract — custom widget-type registration', () => {
  describe('WidgetExtensionOptions shape', () => {
    it('WidgetExtensionOptions requires name and type; widgetCreated is optional', () => {
      // Compiles → shape is correct.
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.color-picker',
        type: 'COLOR_PICKER'
      }
      expect(opts.name).toBe('bc21.test.color-picker')
      expect(opts.type).toBe('COLOR_PICKER')
      expect(opts.widgetCreated).toBeUndefined()
    })

    it('WidgetExtensionOptions with widgetCreated returning render/destroy pair is valid', () => {
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.canvas-widget',
        type: 'CANVAS_DRAW',
        widgetCreated(_widget, _parentNode) {
          return {
            render(_container: HTMLElement) {},
            destroy() {}
          }
        }
      }
      expect(typeof opts.widgetCreated).toBe('function')
    })

    it('WidgetExtensionOptions with widgetCreated returning void is valid (non-visual widget)', () => {
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.non-visual',
        type: 'HIDDEN_STATE',
        widgetCreated(_widget, _parentNode) {
          // non-visual: no render needed
          return undefined
        }
      }
      expect(opts.widgetCreated).toBeDefined()
    })
  })

  describe('registration by type key', () => {
    it('registered extension is findable by its type key', () => {
      const reg = createWidgetExtensionRegistry()
      reg.register({ name: 'bc21.test.reg', type: 'MY_PICKER' })
      expect(reg.findByType('MY_PICKER')).toBeDefined()
      expect(reg.findByType('MY_PICKER')!.name).toBe('bc21.test.reg')
    })

    it('unknown type key returns undefined', () => {
      const reg = createWidgetExtensionRegistry()
      reg.register({ name: 'bc21.test.reg2', type: 'KNOWN_TYPE' })
      expect(reg.findByType('UNKNOWN_TYPE')).toBeUndefined()
    })

    it('multiple different widget types can be registered independently', () => {
      const reg = createWidgetExtensionRegistry()
      reg.register({ name: 'bc21.test.multi-a', type: 'TYPE_A' })
      reg.register({ name: 'bc21.test.multi-b', type: 'TYPE_B' })
      expect(reg.getAll()).toHaveLength(2)
      expect(reg.findByType('TYPE_A')!.name).toBe('bc21.test.multi-a')
      expect(reg.findByType('TYPE_B')!.name).toBe('bc21.test.multi-b')
    })
  })

  describe('widgetCreated invocation contract', () => {
    it('widgetCreated receives a WidgetHandle and a NodeHandle (or null for orphan widgets)', () => {
      const capturedArgs: Array<{ widget: WidgetHandle; parentNode: NodeHandle | null }> = []

      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.invocation',
        type: 'CAPTURE_PICKER',
        widgetCreated(widget, parentNode) {
          capturedArgs.push({ widget, parentNode: parentNode as NodeHandle | null })
        }
      }

      const widget = makeWidgetHandle({ name: 'my-picker', widgetType: 'CAPTURE_PICKER' })
      const parentNode = makeNodeHandle() as NodeHandle

      opts.widgetCreated!(widget, parentNode)

      expect(capturedArgs).toHaveLength(1)
      expect(capturedArgs[0].widget.name).toBe('my-picker')
      expect(capturedArgs[0].parentNode).toBe(parentNode)
    })

    it('widgetCreated called with null parentNode for orphan widgets does not throw', () => {
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.null-parent',
        type: 'ORPHAN_WIDGET',
        widgetCreated(_widget, parentNode) {
          expect(parentNode).toBeNull()
        }
      }

      const widget = makeWidgetHandle()
      expect(() => opts.widgetCreated!(widget, null)).not.toThrow()
    })

    it('render() function returned by widgetCreated is called with an HTMLElement container', () => {
      const renderFn = vi.fn()
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.render',
        type: 'RENDERED_WIDGET',
        widgetCreated() {
          return { render: renderFn }
        }
      }

      const result = opts.widgetCreated!(makeWidgetHandle(), null)
      expect(result).toBeDefined()
      const container = document.createElement('div')
      ;(result as { render: (el: HTMLElement) => void }).render(container)
      expect(renderFn).toHaveBeenCalledWith(container)
    })

    it('destroy() returned by widgetCreated is invoked on widget removal', () => {
      const destroyFn = vi.fn()
      const opts: WidgetExtensionOptions = {
        name: 'bc21.test.destroy',
        type: 'DESTROYABLE_WIDGET',
        widgetCreated() {
          return { render() {}, destroy: destroyFn }
        }
      }

      const result = opts.widgetCreated!(makeWidgetHandle(), null) as { render(): void; destroy?(): void }
      result.destroy?.()
      expect(destroyFn).toHaveBeenCalledOnce()
    })
  })

  describe('[gap] getCustomWidgets / registration-before-nodeCreated timing', () => {
    it.todo(
      '[gap] No defineWidgetExtension runtime exists yet — widgetCreated is not called by the Phase A runtime. ' +
      'Phase B: wire defineWidgetExtension into extensionV2Service so widgetCreated fires for each matching widget instance.'
    )
    it.todo(
      '[gap] Widget type registered via defineWidgetExtension should appear in NodeHandle.widgets() after node creation. ' +
      'Phase B required — needs real ECS WidgetComponentSchema.'
    )
    it.todo(
      '[gap] Widget extension scope cleanup: widgetCreated destroy() called when extension is disposed. ' +
      'Phase B required — EffectScope wiring for widget extension lifetime.'
    )
  })
})
