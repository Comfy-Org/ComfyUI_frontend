import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { SettingTreeNode, useSettingStore } from '@/stores/settingStore'
import type { SettingParams } from '@/types/settingTypes'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { buildTree } from '@/utils/treeUtil'

export function useSettingUI(
  defaultPanel?: 'about' | 'keybinding' | 'extension' | 'server-config'
) {
  const { t } = useI18n()
  const firebaseAuthStore = useFirebaseAuthStore()
  const settingStore = useSettingStore()
  const activeCategory = ref<SettingTreeNode | null>(null)

  const settingRoot = computed<SettingTreeNode>(() => {
    const root = buildTree(
      Object.values(settingStore.settingsById).filter(
        (setting: SettingParams) => setting.type !== 'hidden'
      ),
      (setting: SettingParams) => setting.category || setting.id.split('.')
    )

    const floatingSettings = (root.children ?? []).filter((node) => node.leaf)
    if (floatingSettings.length) {
      root.children = (root.children ?? []).filter((node) => !node.leaf)
      root.children.push({
        key: 'Other',
        label: 'Other',
        leaf: false,
        children: floatingSettings
      })
    }

    return root
  })

  const settingCategories = computed<SettingTreeNode[]>(
    () => settingRoot.value.children ?? []
  )

  // Define panel nodes
  const aboutPanelNode: SettingTreeNode = {
    key: 'about',
    label: 'About',
    children: []
  }

  const creditsPanelNode: SettingTreeNode = {
    key: 'credits',
    label: 'Credits',
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
   * The default category to show when the dialog is opened.
   */
  const defaultCategory = computed<SettingTreeNode>(() => {
    return defaultPanel
      ? settingCategories.value.find((x) => x.key === defaultPanel) ??
          settingCategories.value[0]
      : settingCategories.value[0]
  })

  const translateCategory = (node: SettingTreeNode) => ({
    ...node,
    translatedLabel: t(
      `settingsCategories.${normalizeI18nKey(node.label)}`,
      node.label
    )
  })

  const groupedMenuTreeNodes = computed<SettingTreeNode[]>(() => [
    // Account settings - only show when user is authenticated
    ...(firebaseAuthStore.isAuthenticated
      ? [
          {
            key: 'account',
            label: 'Account',
            children: [creditsPanelNode].map(translateCategory)
          }
        ]
      : []),
    // Normal settings stored in the settingStore
    {
      key: 'settings',
      label: 'Application Settings',
      children: settingCategories.value.map(translateCategory)
    },
    // Special settings such as about, keybinding, extension, server-config
    {
      key: 'specialSettings',
      label: 'Special Settings',
      children: [
        keybindingPanelNode,
        extensionPanelNode,
        aboutPanelNode,
        ...serverConfigPanelNodeList.value
      ].map(translateCategory)
    }
  ])

  onMounted(() => {
    activeCategory.value = defaultCategory.value
  })

  return {
    activeCategory,
    defaultCategory,
    groupedMenuTreeNodes,
    settingCategories
  }
}
