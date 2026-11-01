import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { z } from 'zod'

import type {
  MaskEditorTool,
  MaskEditorToolRegistration
} from '@comfyorg/mask-editor/extensionTypes'

const toolSchema = z.object({
  id: z.string().regex(/^[\w.-]+$/),
  label: z.string().regex(/\S/),
  icon: z.string().optional(),
  createSession: z.custom<MaskEditorTool['createSession']>(
    (value) => typeof value === 'function'
  )
})

export const useMaskEditorExtensionStore = defineStore(
  'maskEditorExtensions',
  () => {
    const tools = shallowRef<readonly MaskEditorTool[]>([])

    function registerTool(tool: MaskEditorTool): MaskEditorToolRegistration {
      if (!toolSchema.safeParse(tool).success)
        return { ok: false, reason: 'invalid-tool' }
      if (tools.value.some((entry) => entry.id === tool.id)) {
        return { ok: false, reason: 'duplicate-id' }
      }
      const registration = Object.freeze({
        id: tool.id,
        label: tool.label,
        icon: tool.icon,
        createSession: tool.createSession.bind(tool)
      })
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
