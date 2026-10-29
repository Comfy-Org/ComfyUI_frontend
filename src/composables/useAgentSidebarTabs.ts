import { useI18n } from 'vue-i18n'

import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useExtensionStore } from '@/stores/extensionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export function useAgentSidebarTabs() {
  const { t } = useI18n()
  const workspaceStore = useWorkspaceStore()
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const settingsDialog = useSettingsDialog()

  function sourceExtension(tab: SidebarTabExtension) {
    const name = workspaceStore.sidebarTab.getSourceExtensionName(tab.id)
    return extensionStore.extensions.find(
      (extension) => extension.name === name
    )
  }

  function isAgentTab(tab: SidebarTabExtension) {
    const extension = sourceExtension(tab)
    return extension ? extensionStore.isAgentCreatedExtension(extension) : false
  }

  async function disableTabExtension(tab: SidebarTabExtension) {
    const extension = sourceExtension(tab)
    if (!extension) return
    const disabled = settingStore.get('Comfy.Extension.Disabled')
    if (disabled.includes(extension.name)) return
    await settingStore.set('Comfy.Extension.Disabled', [
      ...disabled,
      extension.name
    ])
    window.location.reload()
  }

  function getTabContextMenu(tab: SidebarTabExtension): MenuItem[] {
    if (!isAgentTab(tab)) return []
    return [
      {
        label: t('g.manageExtensions'),
        icon: 'icon-[lucide--settings]',
        command: () => settingsDialog.show('extension')
      },
      {
        label: t('g.disableExtension'),
        icon: 'icon-[lucide--circle-off]',
        command: () => disableTabExtension(tab)
      }
    ]
  }

  return { getTabContextMenu, isAgentTab }
}
