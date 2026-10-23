import { t } from '@/i18n'
import { readonly, ref } from 'vue'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { reportError } from '@/platform/telemetry/reportError'
import { useToast } from '@/components/ui/toast/toastStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const disableRequests = new Set<string>()
export type ExtensionFilterType = 'all' | 'core' | 'custom' | 'agentCreated'
const requestedFilter = ref<ExtensionFilterType>()
export const agentExtensionFilterRequest = readonly(requestedFilter)

export function requestAgentExtensionFilter(filter: ExtensionFilterType) {
  requestedFilter.value = filter
}

export function consumeAgentExtensionFilterRequest(
  filter: ExtensionFilterType
) {
  if (requestedFilter.value === filter) requestedFilter.value = undefined
}

export function showAgentExtensionSettings() {
  requestAgentExtensionFilter('agentCreated')
  useSettingsDialog().show('extension')
}

export function getAgentExtensionDisableSettings(
  extensions: readonly ComfyExtension[]
) {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const disabledNames = new Set(settingStore.get('Comfy.Extension.Disabled'))
  const disabledPackPaths = new Set(
    settingStore.get('Comfy.Extension.DisabledPacks')
  )

  for (const extension of extensions) {
    if (extensionStore.isExtensionReadOnly(extension.name)) continue
    const packPath = extensionStore.getAgentExtensionPackPath(extension)
    if (packPath) disabledPackPaths.add(packPath)
    else disabledNames.add(extension.name)
  }

  return {
    'Comfy.Extension.Disabled': [...disabledNames],
    'Comfy.Extension.DisabledPacks': [...disabledPackPaths]
  }
}

export async function disableAgentExtensions(
  extensions: readonly ComfyExtension[]
): Promise<boolean> {
  const requestKey = extensions
    .map(({ name }) => name)
    .sort()
    .join('\n')
  if (!requestKey || disableRequests.has(requestKey)) return false
  disableRequests.add(requestKey)

  try {
    await useSettingStore().setMany(
      getAgentExtensionDisableSettings(extensions)
    )
    window.location.reload()
    return true
  } catch (cause) {
    reportError(cause, {
      errorType: 'failure_disabling_agent_extension',
      surface: 'platform',
      context: { extension_names: extensions.map(({ name }) => name) }
    })
    useToast().error(t('g.agentExtensionDisableFailed'))
    return false
  } finally {
    disableRequests.delete(requestKey)
  }
}
