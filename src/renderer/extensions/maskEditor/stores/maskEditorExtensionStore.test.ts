import { describe, expect, it } from 'vitest'

import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'
import type { MaskEditorTool } from '@comfyorg/mask-editor/extensionTypes'

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
    if (!registration.ok) return

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
})
