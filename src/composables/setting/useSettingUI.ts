import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { SettingTreeNode } from '@/stores/settingStore'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'

export function useSettingUI(
  defaultPanel?: 'about' | 'keybinding' | 'extension' | 'server-config'
) {
  const { t } = useI18n()
  const activeCategory = ref<SettingTreeNode | null>(null)

  // Define panel nodes
  const aboutPanelNode: SettingTreeNode = {
    key: 'about',
    label: 'About',
    children: []
  }

  const keybindingPanelNode: SettingTreeNode = {
    key: 'keybinding',
    label: 'Keybinding',
    children: []
  }

  const extensionPanelNode: SettingTreeNode = {
    key: 'extension',
    label: 'Extension',
    children: []
  }

  const serverConfigPanelNode: SettingTreeNode = {
    key: 'server-config',
    label: 'Server-Config',
    children: []
  }

  /**
   * Server config panel is only available in Electron
   */
  const serverConfigPanelNodeList = computed<SettingTreeNode[]>(() => {
    return isElectron() ? [serverConfigPanelNode] : []
  })

  /**
   * Get the default category to show when the dialog is opened.
   */
  const getDefaultCategory = (categories: SettingTreeNode[]) => {
    return defaultPanel
      ? categories.find((x) => x.key === defaultPanel) ?? categories[0]
      : categories[0]
  }

  /**
   * Create translated categories with labels
   */
  const createTranslatedCategories = (settingCategories: SettingTreeNode[]) => {
    return [
      ...settingCategories,
      keybindingPanelNode,
      extensionPanelNode,
      ...serverConfigPanelNodeList.value,
      aboutPanelNode
    ].map((node) => ({
      ...node,
      translatedLabel: t(
        `settingsCategories.${normalizeI18nKey(node.label)}`,
        node.label
      )
    }))
  }

  return {
    activeCategory,
    getDefaultCategory,
    createTranslatedCategories
  }
}
