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

/**
 * Disables agent-created extensions and reloads once the backend has accepted
 * the write. Never rejects: a refused or unreachable write is reported to the
 * user and answered with `false`, leaving the page as it was.
 */
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
    const result = await useExtensionStore().disableAgentExtensions(extensions)
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
    window.location.reload()
    return true
  } finally {
    disableRequests.delete(requestKey)
  }
}
