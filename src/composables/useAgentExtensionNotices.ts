import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

import { useAgentExtensionActions } from './useAgentExtensionActions'

export function useAgentExtensionNotices() {
  const { t } = useI18n()
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const toast = useToast()
  const settingsDialog = useSettingsDialog()
  const { disableExtension } = useAgentExtensionActions()
  const notified = new Set<string>()

  function showNotice(extension: ComfyExtension) {
    toast.info(t('g.agentExtensionAdded', { name: extension.name }), {
      description: extension.provenance?.summary,
      actions: [
        {
          label: t('g.manageExtensions'),
          onClick: () => settingsDialog.show('extension')
        },
        {
          label: t('g.disableExtension'),
          onClick: () => disableExtension(extension)
        }
      ]
    })
  }

  watch(
    [
      () => settingStore.isReady,
      () => extensionStore.agentExtensions,
      () => extensionStore.areLateCustomNodesPending
    ],
    ([settingsReady, extensions, pending]) => {
      if (!settingsReady || pending) return
      const seen =
        settingStore.settingValues['Comfy.Extension.SeenAgentExtensions'] ?? []
      seen.forEach((name) => notified.add(name))
      const unseen = extensions.filter(({ name }) => !notified.has(name))
      if (!unseen.length) return

      unseen.forEach((extension) => {
        notified.add(extension.name)
        showNotice(extension)
      })
      void settingStore.set('Comfy.Extension.SeenAgentExtensions', [
        ...notified
      ])
    },
    { immediate: true }
  )
}
