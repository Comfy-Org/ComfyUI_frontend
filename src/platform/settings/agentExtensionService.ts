import { t } from '@/i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { showSettingsPanel } from '@/platform/settings/composables/useSettingsDialog'
import { reportError } from '@/platform/telemetry/reportError'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const disableRequests = new Set<string>()

export function showAgentExtensionSettings() {
  showSettingsPanel('extension', { extensionFilter: 'agentCreated' })
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
    const extensionStore = useExtensionStore()
    const result = await extensionStore.disableAgentExtensions(extensions)
    if (!result.ok) {
      reportError(result.detail, {
        errorType: 'failure_disabling_agent_extension',
        surface: 'platform',
        tags: { reason: result.reason },
        context: { extension_names: extensions.map(({ name }) => name) }
      })
      useToast().error(t('g.agentExtensionDisableFailed'))
      return false
    }
    await extensionStore.waitForExtensionSaves()
    window.location.reload()
    return true
  } finally {
    disableRequests.delete(requestKey)
  }
}
