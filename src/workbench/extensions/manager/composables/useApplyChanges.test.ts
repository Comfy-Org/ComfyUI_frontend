import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useApplyChanges } from '@/workbench/extensions/manager/composables/useApplyChanges'

import type * as VueUse from '@vueuse/core'

type Listener = () => void

const {
  listeners,
  managerStore,
  settingStore,
  commandStore,
  workflowService,
  managerService,
  runFullConflictAnalysis,
  useEventListener
} = vi.hoisted(() => ({
  listeners: new Map<string, Listener>(),
  managerStore: {
    setStale: vi.fn()
  },
  settingStore: {
    get: vi.fn(),
    set: vi.fn()
  },
  commandStore: {
    execute: vi.fn()
  },
  workflowService: {
    reloadCurrentWorkflow: vi.fn()
  },
  managerService: {
    rebootComfyUI: vi.fn()
  },
  runFullConflictAnalysis: vi.fn(),
  useEventListener: vi.fn(
    (_target: unknown, event: string, listener: Listener) => {
      listeners.set(event, listener)
      return vi.fn(() => listeners.delete(event))
    }
  )
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    createSharedComposable: <T extends (...args: never[]) => unknown>(fn: T) =>
      fn,
    useEventListener
  }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => workflowService
}))

vi.mock('@/scripts/api', () => ({
  api: {}
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => commandStore
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: () => ({ runFullConflictAnalysis })
  })
)

vi.mock('@/workbench/extensions/manager/services/comfyManagerService', () => ({
  useComfyManagerService: () => managerService
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: () => managerStore
}))

beforeEach(() => {
  vi.useFakeTimers()
  listeners.clear()
  managerStore.setStale.mockReset()
  settingStore.get.mockReset().mockReturnValue(false)
  settingStore.set.mockReset().mockResolvedValue(undefined)
  commandStore.execute.mockReset().mockResolvedValue(undefined)
  workflowService.reloadCurrentWorkflow.mockReset().mockResolvedValue(undefined)
  managerService.rebootComfyUI.mockReset().mockResolvedValue(undefined)
  runFullConflictAnalysis.mockReset().mockResolvedValue(undefined)
  useEventListener.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useApplyChanges', () => {
  it('reboots, handles reconnect, refreshes state, and closes after completion', async () => {
    const onClose = vi.fn()
    const applyChanges = useApplyChanges()

    const applying = applyChanges.applyChanges(onClose)
    listeners.get('reconnected')?.()
    await applying
    await vi.runAllTimersAsync()

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Toast.DisableReconnectingToast',
      true
    )
    expect(managerService.rebootComfyUI).toHaveBeenCalled()
    expect(managerStore.setStale).toHaveBeenCalled()
    expect(commandStore.execute).toHaveBeenCalledWith(
      'Comfy.RefreshNodeDefinitions'
    )
    expect(workflowService.reloadCurrentWorkflow).toHaveBeenCalled()
    expect(runFullConflictAnalysis).toHaveBeenCalled()
    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Toast.DisableReconnectingToast',
      false
    )
    expect(applyChanges.isRestarting.value).toBe(false)
    expect(applyChanges.isRestartCompleted.value).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })

  it('ignores duplicate apply requests while restarting', async () => {
    managerService.rebootComfyUI.mockReturnValue(new Promise(() => {}))
    const applyChanges = useApplyChanges()

    void applyChanges.applyChanges()
    await applyChanges.applyChanges()

    expect(managerService.rebootComfyUI).toHaveBeenCalledTimes(1)
  })

  it('restores the toast setting and reports timeout when reconnect never arrives', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const applyChanges = useApplyChanges()

    await applyChanges.applyChanges()
    await vi.advanceTimersByTimeAsync(120_000)

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Toast.DisableReconnectingToast',
      false
    )
    expect(applyChanges.isRestarting.value).toBe(false)
    expect(applyChanges.isRestartCompleted.value).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(
      '[useApplyChanges] Reconnect timed out'
    )

    errorSpy.mockRestore()
  })

  it('restores state and rethrows when reboot fails', async () => {
    const onClose = vi.fn()
    const error = new Error('reboot failed')
    managerService.rebootComfyUI.mockRejectedValue(error)
    const applyChanges = useApplyChanges()

    await expect(applyChanges.applyChanges(onClose)).rejects.toThrow(error)

    expect(settingStore.set).toHaveBeenCalledWith(
      'Comfy.Toast.DisableReconnectingToast',
      false
    )
    expect(applyChanges.isRestarting.value).toBe(false)
    expect(applyChanges.isRestartCompleted.value).toBe(false)
    expect(onClose).toHaveBeenCalled()
  })
})
