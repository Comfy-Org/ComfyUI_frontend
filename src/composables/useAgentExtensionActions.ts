import { t } from '@/i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
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
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()

  async function disableExtensionNow(extension: ComfyExtension) {
    // The runtime disabled set is snapshotted at load, so a disable that was
    // saved without a reload leaves the extension running. Only a runtime
    // disable means there is nothing left to do here.
    if (!extensionStore.isExtensionEnabled(extension.name)) return false

    const disabled =
      settingStore.settingValues['Comfy.Extension.Disabled'] ?? []
    const alreadySaved = disabled.includes(extension.name)
    const nextDisabled = alreadySaved ? disabled : [...disabled, extension.name]

    // A saved-but-unapplied name needs applying, not a duplicate write.
    if (!alreadySaved) {
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

      // Publish the acknowledged value through the settings owner so
      // `onSettingChanged` and registered `onChange` handlers see it. The write
      // above already persisted it, so this must not write to the server again.
      await settingStore.applySettingLocally(
        'Comfy.Extension.Disabled',
        nextDisabled
      )
    }

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
