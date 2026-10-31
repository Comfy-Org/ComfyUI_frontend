import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type {
  MaskEditorTool,
  MaskEditorToolRegistration
} from '@comfyorg/mask-editor/extensionTypes'

export const useMaskEditorExtensionStore = defineStore(
  'maskEditorExtensions',
  () => {
    const tools = shallowRef<readonly MaskEditorTool[]>([])

    function registerTool(tool: MaskEditorTool): MaskEditorToolRegistration {
      if (!isValidTool(tool)) return { ok: false, reason: 'invalid-tool' }
      if (tools.value.some((entry) => entry.id === tool.id)) {
        return { ok: false, reason: 'duplicate-id' }
      }
      const registration = Object.freeze({ ...tool })
      tools.value = [...tools.value, registration]
      return {
        ok: true,
        unregister: () => {
          tools.value = tools.value.filter((entry) => entry !== registration)
        }
      }
    }

    return { tools, registerTool }
  }
)

function isValidTool(tool: unknown): tool is MaskEditorTool {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'id' in tool &&
    typeof tool.id === 'string' &&
    /^[\w.-]+$/.test(tool.id) &&
    'label' in tool &&
    typeof tool.label === 'string' &&
    tool.label.trim().length > 0 &&
    'createSession' in tool &&
    typeof tool.createSession === 'function'
  )
}
