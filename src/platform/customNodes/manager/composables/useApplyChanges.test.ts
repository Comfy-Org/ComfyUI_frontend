import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { useApplyChanges } from '@/platform/customNodes/manager/composables/useApplyChanges'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'

const runFullConflictAnalysis = vi.hoisted(() => vi.fn(async () => {}))

vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(
  import('@/platform/customNodes/manager/services/comfyManagerService'),
  () => ({
    useComfyManagerService: () =>
      ({
        rebootComfyUI: vi.fn(async () => null),
        listInstalledPacks: vi.fn(async () => null)
      }) as never
  })
)
vi.mock(
  import('@/platform/customNodes/manager/composables/useConflictDetection'),
  () => ({
    useConflictDetection: () => ({ runFullConflictAnalysis }) as never
  })
)

function registerRefreshCommand() {
  const refresh = vi.fn<() => Promise<void>>(async () => {})
  useCommandStore().registerCommand({
    id: 'Comfy.RefreshNodeDefinitions',
    function: refresh
  })
  return refresh
}

async function applyAndReconnect() {
  vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const applyChanges = scope.run(() => useApplyChanges())
  if (!applyChanges) throw new Error('useApplyChanges did not run')
  await applyChanges.applyChanges()
  api.dispatchCustomEvent('reconnected')
  await vi.advanceTimersByTimeAsync(0)
  return applyChanges
}

describe('useApplyChanges', () => {
  it('refreshes node definitions and reloads the workflow after the restart', async () => {
    const refresh = registerRefreshCommand()

    const { isRestartCompleted } = await applyAndReconnect()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().reloadCurrentWorkflow).toHaveBeenCalledOnce()
    expect(runFullConflictAnalysis).toHaveBeenCalledOnce()
    expect(isRestartCompleted.value).toBe(true)
  })

  it('leaves the refresh to the core reconnect refresh when the server reports a boot id', async () => {
    api.serverFeatureFlags.value = { server_boot_id: 'boot-1' }
    onTestFinished(() => {
      api.serverFeatureFlags.value = {}
    })
    const refresh = registerRefreshCommand()

    const { isRestartCompleted } = await applyAndReconnect()

    expect(refresh).not.toHaveBeenCalled()
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
    expect(runFullConflictAnalysis).toHaveBeenCalledOnce()
    expect(isRestartCompleted.value).toBe(true)
  })
})
