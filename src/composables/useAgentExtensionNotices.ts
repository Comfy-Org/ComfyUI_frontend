import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

export function useAgentExtensionNotices() {
  const { t } = useI18n()
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const toast = useToast()
  const settingsDialog = useSettingsDialog()
  const notified = new Set(
    settingStore.get('Comfy.Extension.SeenAgentExtensions')
  )

  function disableExtension(extension: ComfyExtension) {
    const disabled = settingStore.get('Comfy.Extension.Disabled')
    if (!disabled.includes(extension.name)) {
      void settingStore
        .set('Comfy.Extension.Disabled', [...disabled, extension.name])
        .then(() => window.location.reload())
    }
  }

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
      () => extensionStore.agentExtensions,
      () => extensionStore.areLateExtensionsPending
    ],
    ([extensions, pending]) => {
      if (pending) return
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
