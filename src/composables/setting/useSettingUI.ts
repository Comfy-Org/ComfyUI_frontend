import {
  type Component,
  computed,
  defineAsyncComponent,
  onMounted,
  ref
} from 'vue'
import { useI18n } from 'vue-i18n'

import { SettingTreeNode, useSettingStore } from '@/stores/settingStore'
import type { SettingParams } from '@/types/settingTypes'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { buildTree } from '@/utils/treeUtil'

import { useCurrentUser } from '../auth/useCurrentUser'

interface SettingPanelItem {
  node: SettingTreeNode
  component: Component
}

export function useSettingUI(
  defaultPanel?:
    | 'about'
    | 'keybinding'
    | 'extension'
    | 'server-config'
    | 'user'
    | 'credits'
) {
  const { t } = useI18n()
  const { isLoggedIn } = useCurrentUser()
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

  // Define panel items
  const aboutPanel: SettingPanelItem = {
    node: {
      key: 'about',
      label: 'About',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/AboutPanel.vue')
    )
  }

  const creditsPanel: SettingPanelItem = {
    node: {
      key: 'credits',
      label: 'Credits',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/CreditsPanel.vue')
    )
  }

  const userPanel: SettingPanelItem = {
    node: {
      key: 'user',
      label: 'User',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/UserPanel.vue')
    )
  }

  const keybindingPanel: SettingPanelItem = {
    node: {
      key: 'keybinding',
      label: 'Keybinding',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/KeybindingPanel.vue')
    )
  }

  const extensionPanel: SettingPanelItem = {
    node: {
      key: 'extension',
      label: 'Extension',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/ExtensionPanel.vue')
    )
  }

  const serverConfigPanel: SettingPanelItem = {
    node: {
      key: 'server-config',
      label: 'Server-Config',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/ServerConfigPanel.vue')
    )
  }

  const panels = computed<SettingPanelItem[]>(() =>
    [
      aboutPanel,
      creditsPanel,
      userPanel,
      keybindingPanel,
      extensionPanel,
      ...(isElectron() ? [serverConfigPanel] : [])
    ].filter((panel) => panel.component)
  )

  /**
   * The default category to show when the dialog is opened.
   */
  const defaultCategory = computed<SettingTreeNode>(() => {
    if (!defaultPanel) return settingCategories.value[0]
    // Search through all groups in groupedMenuTreeNodes
    for (const group of groupedMenuTreeNodes.value) {
      const found = group.children?.find((node) => node.key === defaultPanel)
      if (found) return found
    }
    return settingCategories.value[0]
  })

  const translateCategory = (node: SettingTreeNode) => ({
    ...node,
    translatedLabel: t(
      `settingsCategories.${normalizeI18nKey(node.label)}`,
      node.label
    )
  })

  const groupedMenuTreeNodes = computed<SettingTreeNode[]>(() => [
    // Account settings - only show credits when user is authenticated
    {
      key: 'account',
      label: 'Account',
      children: [
        userPanel.node,
        ...(isLoggedIn.value ? [creditsPanel.node] : [])
      ].map(translateCategory)
    },
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
        keybindingPanel.node,
        extensionPanel.node,
        aboutPanel.node,
        ...(isElectron() ? [serverConfigPanel.node] : [])
      ].map(translateCategory)
    }
  ])

  onMounted(() => {
    activeCategory.value = defaultCategory.value
  })

  return {
    panels,
    activeCategory,
    defaultCategory,
    groupedMenuTreeNodes,
    settingCategories
  }
}
