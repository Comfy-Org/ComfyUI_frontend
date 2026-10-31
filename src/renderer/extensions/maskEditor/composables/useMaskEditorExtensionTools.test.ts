import { effectScope } from 'vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useMaskEditorExtensionStore } from '@/renderer/extensions/maskEditor/stores/maskEditorExtensionStore'

import { useMaskEditorExtensionTools } from './useMaskEditorExtensionTools'

describe('MaskEditor extension failures', () => {
  it('reports an unusable tool to the user and leaves native tools available', () => {
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const failure = new Error('tool failed to initialize')
    const registry = useMaskEditorExtensionStore()
    registry.registerTool({
      id: 'test.broken',
      label: 'Broken tool',
      createSession: () => {
        throw failure
      }
    })
    scope.run(() => {
      const tools = useMaskEditorExtensionTools()
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
  })

  it('keeps the current session when an earlier async callback fails', async () => {
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const failure = new Error('request failed after switching tools')
    const reject = vi.fn<() => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(() => rejectPromise(failure))
    })
    const registry = useMaskEditorExtensionStore()
    registry.registerTool({
      id: 'test.delayed',
      label: 'Delayed tool',
      createSession: () => ({ onPointer: () => pending })
    })
    registry.registerTool({
      id: 'test.current',
      label: 'Current tool',
      createSession: () => ({})
    })
    const tools = scope.run(() => useMaskEditorExtensionTools())!
    tools.activate('test.delayed')
    const callback = tools.active.value!.runtime.pointer({
      phase: 'down',
      x: 0,
      y: 0,
      inBounds: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      pressure: 0.5,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false
    })
    tools.activate('test.current')
    reject()
    await callback
    expect(tools.isActive()).toBe(true)
    expect(tools.active.value?.tool.id).toBe('test.current')
  })

  it('disposes the active session immediately when its registration is removed', () => {
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const dispose = vi.fn()
    const registration = useMaskEditorExtensionStore().registerTool({
      id: 'test.disposable',
      label: 'Disposable tool',
      createSession: () => ({ dispose })
    })
    expect(registration.ok).toBe(true)
    if (!registration.ok) return
    scope.run(() => {
      const tools = useMaskEditorExtensionTools()
      tools.activate('test.disposable')
      expect(tools.isActive()).toBe(true)
      registration.unregister()
      expect(tools.isActive()).toBe(false)
      expect(dispose).toHaveBeenCalledTimes(1)
    })
  })
})
