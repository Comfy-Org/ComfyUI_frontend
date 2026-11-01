import { render } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { assert, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'
import type { MaskEditorTool } from '@comfyorg/mask-editor/extensionTypes'
import { useToast } from '@/components/ui/toast/toastStore'
import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'

import { useMaskEditorExtensionTools } from './useMaskEditorExtensionTools'

function mountExtensionTools() {
  let tools: ReturnType<typeof useMaskEditorExtensionTools> | undefined
  render(
    {
      setup() {
        tools = useMaskEditorExtensionTools()
        return () => null
      }
    },
    {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: {
              en: { maskEditor: { toolFailed: 'Tool {tool} failed' } }
            }
          })
        ]
      }
    }
  )
  assert(tools)
  return tools
}

describe('MaskEditor extension failures', () => {
  it('reports an unusable tool to the user and leaves native tools available', () => {
    const failure = new Error('tool failed to initialize')
    const registry = useMaskEditorExtensionStore()
    registry.registerTool({
      id: 'test.broken',
      label: 'Broken tool',
      createSession: () => {
        throw failure
      }
    })
    const tools = mountExtensionTools()
    tools.activate('test.broken')
    expect(tools.isActive()).toBe(false)
    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'failure_running_mask_editor_extension',
      surface: 'workspace'
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: expect.stringContaining('Broken tool')
      })
    ])
  })

  it('disposes the active session immediately when its registration is removed', () => {
    const dispose = vi.fn()
    const registration = useMaskEditorExtensionStore().registerTool({
      id: 'test.disposable',
      label: 'Disposable tool',
      createSession: () => ({ dispose })
    })
    expect(registration.ok).toBe(true)
    assert(registration.ok)
    const tools = mountExtensionTools()
    tools.activate('test.disposable')
    expect(tools.isActive()).toBe(true)
    registration.unregister()
    expect(tools.isActive()).toBe(false)
    expect(dispose).toHaveBeenCalledTimes(1)
  })

  it('reports delayed cleanup without closing a newly activated session of the same tool', async () => {
    const failure = new Error('Previous session cleanup failed')
    const reject = vi.fn<(error: unknown) => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(rejectPromise)
    })
    const createSession = vi
      .fn<MaskEditorTool['createSession']>()
      .mockReturnValueOnce({ dispose: () => pending })
      .mockReturnValue({})
    useMaskEditorExtensionStore().registerTool({
      id: 'test.cleanup',
      label: 'Cleanup tool',
      createSession
    })
    const tools = mountExtensionTools()
    tools.activate('test.cleanup')
    tools.deactivate()
    tools.activate('test.cleanup')
    reject(failure)
    await pending.catch(() => undefined)
    expect(tools.isActive()).toBe(true)
    expect(tools.active.value?.runtime.context.signal.aborted).toBe(false)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'failure_running_mask_editor_extension',
      surface: 'workspace'
    })
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        title: expect.stringContaining('Cleanup tool')
      })
    ])
  })
})
