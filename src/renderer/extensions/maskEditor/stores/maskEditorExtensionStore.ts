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

function prepareTool(tool: MaskEditorTool) {
  try {
    const result = toolSchema.safeParse(tool)
    if (!result.success) return undefined
    return {
      ...result.data,
      createSession: result.data.createSession.bind(tool)
    }
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
      const prepared = prepareTool(tool)
      if (!prepared) return { ok: false, reason: 'invalid-tool' }
      if (tools.value.some((entry) => entry.id === prepared.id)) {
        return { ok: false, reason: 'duplicate-id' }
      }
      const registration = Object.freeze(prepared)
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
