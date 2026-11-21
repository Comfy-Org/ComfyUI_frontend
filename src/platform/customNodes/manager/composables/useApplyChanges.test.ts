import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope } from 'vue'

import { useApplyChanges } from '@/platform/customNodes/manager/composables/useApplyChanges'
import { useConflictDetection } from '@/platform/customNodes/manager/composables/useConflictDetection'
import { useComfyManagerService } from '@/platform/customNodes/manager/services/comfyManagerService'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { api } from '@/scripts/api'

vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/customNodes/manager/services/comfyManagerService'), {
  spy: true
})
vi.mock(
  import('@/platform/customNodes/manager/composables/useConflictDetection'),
  { spy: true }
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
  const started = scope.run(() => {
    const service = useComfyManagerService()
    vi.spyOn(service, 'rebootComfyUI').mockResolvedValue(null)
    vi.spyOn(service, 'listInstalledPacks').mockResolvedValue(null)
    vi.mocked(useComfyManagerService).mockReturnValue(service)

    const detection = useConflictDetection()
    const runFullConflictAnalysis = vi
      .spyOn(detection, 'runFullConflictAnalysis')
      .mockResolvedValue({ success: true, results: [] })
    vi.mocked(useConflictDetection).mockReturnValue(detection)

    return { applyChanges: useApplyChanges(), runFullConflictAnalysis }
  })
  if (!started) throw new Error('useApplyChanges did not run')
  await started.applyChanges.applyChanges()
  api.serverFeatureFlagsSettled.value = false
  api.dispatchCustomEvent('reconnected')
  await vi.advanceTimersByTimeAsync(0)
  api.serverFeatureFlagsSettled.value = true
  await vi.advanceTimersByTimeAsync(0)
  return {
    isRestartCompleted: started.applyChanges.isRestartCompleted,
    runFullConflictAnalysis: started.runFullConflictAnalysis
  }
}

describe('useApplyChanges', () => {
  it('refreshes node definitions and reloads the workflow after the restart', async () => {
    const refresh = registerRefreshCommand()

    const { isRestartCompleted, runFullConflictAnalysis } =
      await applyAndReconnect()

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

    const { isRestartCompleted, runFullConflictAnalysis } =
      await applyAndReconnect()

    expect(refresh).not.toHaveBeenCalled()
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
    expect(runFullConflictAnalysis).toHaveBeenCalledOnce()
    expect(isRestartCompleted.value).toBe(true)
  })

  it('waits for feature flags to settle before trusting a stale boot id on reconnect', async () => {
    api.serverFeatureFlags.value = { server_boot_id: 'boot-1' }
    api.serverFeatureFlagsSettled.value = true
    onTestFinished(() => {
      api.serverFeatureFlags.value = {}
      api.serverFeatureFlagsSettled.value = false
    })
    const refresh = registerRefreshCommand()
    vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    const started = scope.run(() => {
      const service = useComfyManagerService()
      vi.spyOn(service, 'rebootComfyUI').mockResolvedValue(null)
      vi.spyOn(service, 'listInstalledPacks').mockResolvedValue(null)
      vi.mocked(useComfyManagerService).mockReturnValue(service)

      const detection = useConflictDetection()
      vi.spyOn(detection, 'runFullConflictAnalysis').mockResolvedValue({
        success: true,
        results: []
      })
      vi.mocked(useConflictDetection).mockReturnValue(detection)

      return { applyChanges: useApplyChanges() }
    })
    if (!started) throw new Error('useApplyChanges did not run')
    await started.applyChanges.applyChanges()

    // A new socket opens: feature flags unsettle, but the old server's map
    // is still in place until the new server's reply (or lack of one) lands.
    api.serverFeatureFlagsSettled.value = false
    api.dispatchCustomEvent('reconnected')
    await vi.advanceTimersByTimeAsync(0)
    expect(refresh).not.toHaveBeenCalled()

    // The new server doesn't report a boot id, so Manager must run its own
    // refresh instead of deferring to the core reconnect refresh.
    api.serverFeatureFlags.value = {}
    api.serverFeatureFlagsSettled.value = true
    await vi.advanceTimersByTimeAsync(0)

    expect(refresh).toHaveBeenCalledOnce()
  })
})
