import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { isCloud } from '@/platform/distribution/types'
import type { SettingTreeNode } from '@/platform/settings/settingStore'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { SettingParams } from '@/platform/settings/types'
import { isElectron } from '@/utils/envUtil'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { buildTree } from '@/utils/treeUtil'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'

interface SettingPanelItem {
  node: SettingTreeNode
  component: Component
  props?: Record<string, unknown>
}

export function useSettingUI(
  defaultPanel?:
    | 'about'
    | 'keybinding'
    | 'extension'
    | 'server-config'
    | 'user'
    | 'credits'
    | 'subscription'
    | 'workspace'
    | 'workspace-plan'
    | 'workspace-members'
) {
  const { t } = useI18n()
  const { isLoggedIn } = useCurrentUser()
  const settingStore = useSettingStore()
  const activeCategory = ref<SettingTreeNode | null>(null)

  const { shouldRenderVueNodes } = useVueFeatureFlags()
  const { isActiveSubscription } = useSubscription()
  const { workspaceName } = useWorkspace()

  const settingRoot = computed<SettingTreeNode>(() => {
    const root = buildTree(
      Object.values(settingStore.settingsById).filter(
        (setting: SettingParams) =>
          setting.type !== 'hidden' &&
          !(shouldRenderVueNodes.value && setting.hideInVueNodes)
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

  // Core setting categories (built-in to ComfyUI) in display order
  // 'Other' includes floating settings that don't have a specific category
  const CORE_CATEGORIES_ORDER = [
    'Comfy',
    'LiteGraph',
    'Appearance',
    '3D',
    'Mask Editor',
    'Other'
  ]
  const CORE_CATEGORIES = new Set(CORE_CATEGORIES_ORDER)

  const coreSettingCategories = computed<SettingTreeNode[]>(() => {
    const categories = settingCategories.value.filter((node) =>
      CORE_CATEGORIES.has(node.label)
    )
    return categories.sort(
      (a, b) =>
        CORE_CATEGORIES_ORDER.indexOf(a.label) -
        CORE_CATEGORIES_ORDER.indexOf(b.label)
    )
  })

  const customNodeSettingCategories = computed<SettingTreeNode[]>(() =>
    settingCategories.value.filter((node) => !CORE_CATEGORIES.has(node.label))
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
      () => import('@/components/dialog/content/setting/LegacyCreditsPanel.vue')
    )
  }

  const subscriptionPanel: SettingPanelItem | null =
    !isCloud || !window.__CONFIG__?.subscription_required
      ? null
      : {
          node: {
            key: 'subscription',
            label: 'PlanCredits',
            children: []
          },
          component: defineAsyncComponent(
            () =>
              import('@/platform/cloud/subscription/components/SubscriptionPanel.vue')
          )
        }

  const shouldShowPlanCreditsPanel = computed(() => {
    if (!subscriptionPanel) return false
    return isActiveSubscription.value
  })

  const userPanel: SettingPanelItem = {
    node: {
      key: 'user',
      label: 'Profile',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/UserPanel.vue')
    )
  }

  const workspacePanel: SettingPanelItem = {
    node: {
      key: 'workspace',
      label: 'Workspace',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/components/dialog/content/setting/WorkspacePanel.vue')
    )
  }

  // Sidebar-only node for Plan & Credits (uses same WorkspacePanel component)
  const workspacePlanNode: SettingTreeNode = {
    key: 'workspace-plan',
    label: 'WorkspacePlan',
    children: []
  }

  // Sidebar-only node for Members (uses same WorkspacePanel component)
  const workspaceMembersNode: SettingTreeNode = {
    key: 'workspace-members',
    label: 'WorkspaceMembers',
    children: []
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
      () => import('@/platform/settings/components/ExtensionPanel.vue')
    )
  }

  const serverConfigPanel: SettingPanelItem = {
    node: {
      key: 'server-config',
      label: 'Server-Config',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/platform/settings/components/ServerConfigPanel.vue')
    )
  }

  const panels = computed<SettingPanelItem[]>(() =>
    [
      aboutPanel,
      creditsPanel,
      userPanel,
      workspacePanel,
      keybindingPanel,
      extensionPanel,
      ...(isElectron() ? [serverConfigPanel] : []),
      ...(shouldShowPlanCreditsPanel.value && subscriptionPanel
        ? [subscriptionPanel]
        : [])
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
    // Workspace settings
    {
      key: 'workspace',
      label: 'Workspace',
      children: [
        workspacePanel.node,
        workspacePlanNode,
        ...(workspaceName.value ? [workspaceMembersNode] : []),
        ...(isLoggedIn.value &&
        !(isCloud && window.__CONFIG__?.subscription_required)
          ? [creditsPanel.node]
          : [])
      ].map(translateCategory)
    },
    // General settings - Profile + all core settings + special panels
    {
      key: 'general',
      label: 'General',
      children: [
        translateCategory(userPanel.node),
        ...coreSettingCategories.value.map(translateCategory),
        translateCategory(keybindingPanel.node),
        translateCategory(extensionPanel.node),
        translateCategory(aboutPanel.node),
        ...(isElectron() ? [translateCategory(serverConfigPanel.node)] : [])
      ]
    },
    // Custom node settings (only shown if custom nodes have registered settings)
    ...(customNodeSettingCategories.value.length > 0
      ? [
          {
            key: 'other',
            label: 'Other',
            children: customNodeSettingCategories.value.map(translateCategory)
          }
        ]
      : [])
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
