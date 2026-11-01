import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { z } from 'zod'

import type {
  MaskEditorTool,
  MaskEditorToolRegistration
} from '@comfyorg/mask-editor/extensionTypes'
import { reportError } from '@comfyorg/telemetry/reportError'

const toolSchema = z.object({
  id: z.string().regex(/^[\w.-]+$/),
  label: z.string().regex(/\S/),
  icon: z.string().optional(),
  createSession: z.custom<MaskEditorTool['createSession']>(
    (value) => typeof value === 'function'
  )
})

function parseTool(tool: MaskEditorTool) {
  try {
    const result = toolSchema.safeParse(tool)
    return result.success ? result.data : undefined
  } catch (error) {
    reportError(error, {
      errorType: 'failure_registering_mask_editor_tool',
      surface: 'workspace'
    })
    return undefined
  }
}

export const useMaskEditorExtensionStore = defineStore(
  'maskEditorExtensions',
  () => {
    const tools = shallowRef<readonly MaskEditorTool[]>([])

    function registerTool(tool: MaskEditorTool): MaskEditorToolRegistration {
      const parsed = parseTool(tool)
      if (!parsed) return { ok: false, reason: 'invalid-tool' }
      if (tools.value.some((entry) => entry.id === parsed.id)) {
        return { ok: false, reason: 'duplicate-id' }
      }
      const registration = Object.freeze({
        ...parsed,
        createSession: parsed.createSession.bind(tool)
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
