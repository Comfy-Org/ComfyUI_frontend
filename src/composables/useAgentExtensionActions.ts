import { t } from '@/i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import type { ComfyExtension } from '@/types/comfy'
import { reportError } from '@comfyorg/telemetry/reportError'

const pendingDisables = new Set<string>()
let disableChain: Promise<void> = Promise.resolve()

function reportDisableFailure(extension: ComfyExtension, cause: unknown) {
  reportError(cause, {
    surface: 'platform',
    errorType: 'failure_disabling_agent_extension',
    context: { extension_name: extension.name }
  })
  useToast().error(t('g.agentExtensionDisableFailed'))
}

export function useAgentExtensionActions() {
  const settingStore = useSettingStore()

  async function disableExtensionNow(extension: ComfyExtension) {
    const disabled =
      settingStore.settingValues['Comfy.Extension.Disabled'] ?? []
    if (disabled.includes(extension.name)) return false
    const nextDisabled = [...disabled, extension.name]

    let response: Response
    try {
      response = await api.storeSetting(
        'Comfy.Extension.Disabled',
        nextDisabled
      )
    } catch (cause) {
      reportDisableFailure(extension, cause)
      return false
    }

    if (!response.ok) {
      reportDisableFailure(
        extension,
        new Error(
          `Failed to disable extension: ${response.status} ${response.statusText}`.trim()
        )
      )
      return false
    }

    settingStore.settingValues['Comfy.Extension.Disabled'] = nextDisabled
    window.location.reload()
    return true
  }

  async function disableExtension(extension: ComfyExtension) {
    if (pendingDisables.has(extension.name)) return false
    pendingDisables.add(extension.name)

    const result = disableChain.then(() => disableExtensionNow(extension))
    disableChain = result.then(
      () => undefined,
      () => undefined
    )
    try {
      return await result
    } finally {
      pendingDisables.delete(extension.name)
    }
  }

  return { disableExtension }
}
