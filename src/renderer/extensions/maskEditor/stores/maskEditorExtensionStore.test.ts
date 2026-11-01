import { assert, describe, expect, it } from 'vitest'

import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'
import type {
  MaskEditorTool,
  MaskEditorToolContext
} from '@comfyorg/mask-editor/extensionTypes'

const tool: MaskEditorTool = {
  id: 'impact.sam',
  label: 'SAM',
  createSession: () => ({})
}

describe('MaskEditor tool registration', () => {
  it('makes a registered tool available and removes only its registration', () => {
    const registry = useMaskEditorExtensionStore()
    const registration = registry.registerTool(tool)
    expect(registration.ok).toBe(true)
    expect(registry.tools.map((item) => item.id)).toEqual(['impact.sam'])
    assert(registration.ok)

    expect(registry.registerTool(tool)).toEqual({
      ok: false,
      reason: 'duplicate-id'
    })
    registration.unregister()
    expect(registry.tools).toEqual([])
    expect(registry.registerTool(tool).ok).toBe(true)
    registration.unregister()
    expect(registry.tools.map((item) => item.id)).toEqual(['impact.sam'])
  })

  it('rejects an empty tool id without changing the available tools', () => {
    const registry = useMaskEditorExtensionStore()
    expect(registry.registerTool({ ...tool, id: '' })).toEqual({
      ok: false,
      reason: 'invalid-tool'
    })
    expect(registry.tools).toEqual([])
  })

  it('rejects a JavaScript tool with a non-string icon without reserving its id', () => {
    const registry = useMaskEditorExtensionStore()
    registry.registerTool(tool)
    const invalid = { ...tool, id: 'test.icon', icon: {} }

    expect(Reflect.apply(registry.registerTool, registry, [invalid])).toEqual({
      ok: false,
      reason: 'invalid-tool'
    })
    expect(registry.tools.map((item) => item.id)).toEqual(['impact.sam'])

    const icon = 'icon-[lucide--crosshair]'
    expect(registry.registerTool({ ...invalid, icon }).ok).toBe(true)
    expect(registry.tools.map((item) => item.icon)).toEqual([undefined, icon])
  })

  it('activates a class-based tool with its original receiver', () => {
    class SelectionTool implements MaskEditorTool {
      id = 'test.class'
      label = 'Class tool'
      private panelText = 'Ready to select'

      createSession() {
        const text = this.panelText
        return {
          mountPanel: (container: HTMLElement) => {
            container.textContent = text
          }
        }
      }
    }
    const registry = useMaskEditorExtensionStore()
    expect(registry.registerTool(new SelectionTool()).ok).toBe(true)
    const registered = registry.tools[0]
    assert.exists(registered)
    const context: MaskEditorToolContext = {
      signal: new AbortController().signal,
      readImage: () => undefined,
      setOverlay: () => false,
      commitMask: () => ({ ok: false, reason: 'unavailable' })
    }
    const panel = document.createElement('div')
    registered.createSession(context).mountPanel?.(panel)
    expect(panel.textContent).toBe('Ready to select')
  })
})
