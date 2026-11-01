import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import {
  getExtensionPath,
  isSafeExtensionBootActive,
  loadCustomNodeScripts,
  shouldLoadCustomNodeScript
} from '@/platform/customNodes/customNodeScripts'
import { askCpuServer } from '@/platform/customNodes/lateLoading/cpuServerStep'
import { lateLoadingApplies } from '@/platform/customNodes/lateLoading/lateLoading'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
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
  const extensions = await api.getExtensions()
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
  await loadCustomNodeScripts(extensions, signal, firstCpuServerReading, {
    disabledExtensionPaths,
    disableAllCustomExtensions
  })
}
