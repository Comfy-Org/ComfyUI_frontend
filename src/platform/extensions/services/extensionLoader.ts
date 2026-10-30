import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import { loadCustomNodeScripts } from '@/platform/customNodes/customNodeScripts'
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
  extensionStore.loadDisabledExtensionNames(
    useSettingStore().get('Comfy.Extension.Disabled')
  )

  const firstCpuServerReading = lateLoadingApplies()
    ? askCpuServer()
    : undefined
  const extensions = await api.getExtensions()

  installErrorNodeWidgets()
  installTouchPointerGuards()
  await bootstrapTracer.settle('bootstrap/extensions-load-core', async () => {
    const { registerCoreExtensions } = await import('@/extensions/core/index')
    await registerCoreExtensions()
  })
  extensionStore.captureCoreExtensions()
  await loadCustomNodeScripts(extensions, signal, firstCpuServerReading)
}
