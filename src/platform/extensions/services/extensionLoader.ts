import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import {
  getExtensionPath,
  loadCustomNodeScripts,
  shouldLoadCustomNodeScript
} from '@/platform/customNodes/customNodeScripts'
import { isSafeExtensionBootActive } from '@/platform/customNodes/safeExtensionBoot'
import { askCpuServer } from '@/platform/customNodes/lateLoading/cpuServerStep'
import { lateLoadingApplies } from '@/platform/customNodes/lateLoading/lateLoading'
import { fetchExtensionPacks } from '@/platform/extensions/services/extensionPacks'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useComfyApiStore } from '@/platform/nodeApi/v4/comfyApiStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { api } from '@/scripts/api'
import { installErrorNodeWidgets } from '@/scripts/errorNodeWidgets'

/**
 * Registers the core extensions, then loads the custom node scripts the backend serves.
 * Late custom nodes stop turning on when `signal` aborts.
 */
export async function loadExtensions(
  signal: AbortSignal = new AbortController().signal
) {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  extensionStore.loadDisabledExtensionNames(
    settingStore.get('Comfy.Extension.Disabled')
  )
  const disabledExtensionPaths = settingStore.get(
    'Comfy.Extension.DisabledPacks'
  )
  const disableAllCustomExtensions = isSafeExtensionBootActive()

  const firstCpuServerReading = lateLoadingApplies()
    ? askCpuServer()
    : undefined
  const [extensions, servedPacks] = await Promise.all([
    api.getExtensions(),
    fetchExtensionPacks()
  ])
  useComfyApiStore().providePacks(servedPacks)
  extensionStore.loadExtensionPaths(
    extensions
      .filter((extension) =>
        shouldLoadCustomNodeScript(extension, {
          isCloudBuild: __DISTRIBUTION__ === 'cloud'
        })
      )
      .flatMap((extension) => {
        const extensionPath = getExtensionPath(extension)
        return extensionPath === undefined ? [] : [extensionPath]
      }),
    disabledExtensionPaths
  )

  installErrorNodeWidgets()
  installTouchPointerGuards()
  await bootstrapTracer.settle('bootstrap/extensions-load-core', async () => {
    const { registerCoreExtensions } = await import('@/extensions/core/index')
    await registerCoreExtensions()
  })
  extensionStore.captureCoreExtensions()
  settingStore.deferExtensionSettingCallbacks(signal)
  await loadCustomNodeScripts(extensions, signal, firstCpuServerReading, {
    disabledExtensionPaths,
    disableAllCustomExtensions
  })
}
