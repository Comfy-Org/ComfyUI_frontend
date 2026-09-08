import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import { isCloud, isDesktop } from '@/platform/distribution/types'
import {
  getSettingInfo,
  useSettingStore
} from '@/platform/settings/settingStore'
import type { SettingTreeNode } from '@/platform/settings/settingStore'
import type { SettingPanelType, SettingParams } from '@/platform/settings/types'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import type { NavGroupData } from '@/types/navTypes'
import { normalizeI18nKey } from '@/utils/formatUtil'
import { buildTree } from '@/utils/treeUtil'

const CATEGORY_ICONS: Record<string, string> = {
  '3D': 'icon-[lucide--box]',
  about: 'icon-[lucide--info]',
  Appearance: 'icon-[lucide--palette]',
  Comfy: 'icon-[lucide--settings]',
  credits: 'icon-[lucide--coins]',
  extension: 'icon-[lucide--puzzle]',
  keybinding: 'icon-[lucide--keyboard]',
  LiteGraph: 'icon-[lucide--workflow]',
  'Mask Editor': 'icon-[lucide--pen-tool]',
  Members: 'icon-[lucide--users]',
  Other: 'icon-[lucide--ellipsis]',
  PlanCredits: 'icon-[lucide--receipt-text]',
  secrets: 'icon-[lucide--key-round]',
  'server-config': 'icon-[lucide--server]',
  user: 'icon-[lucide--user]',
  workspace: 'icon-[lucide--building-2]',
  'workspace-allowlist': 'icon-[comfy--ai-model]',
  'workspace-members': 'icon-[lucide--users]'
}

interface SettingPanelItem {
  node: SettingTreeNode
  component: Component
  props?: Record<string, unknown>
}

export function useSettingUI(
  defaultPanel?: SettingPanelType,
  scrollToSettingId?: string
) {
  const { t } = useI18n()
  const { isLoggedIn } = useCurrentUser()
  const settingStore = useSettingStore()
  const activeCategory = ref<SettingTreeNode | null>(null)

  const { flags } = useFeatureFlags()
  const { shouldRenderVueNodes } = useVueFeatureFlags()
  const { workspaceRole } = useWorkspaceUI()
  const governanceStore = usePartnerNodeGovernanceStore()

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

  const workspaceSettingsPanelComponent = defineAsyncComponent(
    () =>
      import('@/platform/workspace/components/dialogs/settings/WorkspaceSettingsPanelContent.vue')
  )

  const planCreditsPanel: SettingPanelItem = {
    node: {
      key: 'workspace',
      label: 'PlanCredits',
      children: []
    },
    component: workspaceSettingsPanelComponent,
    props: { section: 'planCredits' }
  }

  const membersPanel: SettingPanelItem = {
    node: {
      key: 'workspace-members',
      label: 'Members',
      children: []
    },
    component: workspaceSettingsPanelComponent,
    props: { section: 'members' }
  }

  const allowlistPanel: SettingPanelItem = {
    node: {
      key: 'workspace-allowlist',
      label: 'Allowlist',
      children: []
    },
    component: workspaceSettingsPanelComponent,
    props: { section: 'allowlist' }
  }

  const shouldShowWorkspacePanel = computed(() => isLoggedIn.value)
  const shouldShowWorkspaceAllowlist = computed(
    () =>
      isCloud &&
      shouldShowWorkspacePanel.value &&
      flags.partnerNodeGovernanceEnabled &&
      workspaceRole.value === 'owner'
  )

  const visibleWorkspacePanels = computed<SettingPanelItem[]>(() => {
    if (!shouldShowWorkspacePanel.value) return []
    const workspacePanels = isCloud
      ? [planCreditsPanel, membersPanel]
      : [planCreditsPanel]
    return shouldShowWorkspaceAllowlist.value
      ? [...workspacePanels, allowlistPanel]
      : workspacePanels
  })

  const secretsPanel: SettingPanelItem = {
    node: {
      key: 'secrets',
      label: 'Secrets',
      children: []
    },
    component: defineAsyncComponent(
      () => import('@/platform/secrets/components/SecretsPanel.vue')
    )
  }

  const shouldShowSecretsPanel = computed(
    () => flags.userSecretsEnabled && isLoggedIn.value
  )

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

  const panels = computed<SettingPanelItem[]>(() => [
    aboutPanel,
    creditsPanel,
    userPanel,
    ...visibleWorkspacePanels.value,
    keybindingPanel,
    extensionPanel,
    ...(isDesktop ? [serverConfigPanel] : []),
    ...(shouldShowSecretsPanel.value ? [secretsPanel] : [])
  ])

  /**
   * The default category to show when the dialog is opened.
   */
  const defaultCategory = computed<SettingTreeNode>(() => {
    if (defaultPanel) {
      for (const group of groupedMenuTreeNodes.value) {
        const found = group.children?.find((node) => node.key === defaultPanel)
        if (found) return found
      }
      const hiddenPanel = panels.value.find(
        (panel) => panel.node.key === defaultPanel
      )
      if (hiddenPanel) return translateCategory(hiddenPanel.node)
      return settingCategories.value[0]
    }

    if (scrollToSettingId) {
      if (Object.hasOwn(settingStore.settingsById, scrollToSettingId)) {
        const setting = settingStore.settingsById[scrollToSettingId]
        const { category } = getSettingInfo(setting)
        const found = settingCategories.value.find((c) => c.label === category)
        if (found) return found
      }
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

  const workspaceMenuTreeNodes = computed<SettingTreeNode[]>(() => [
    translateCategory({
      key: 'workspace',
      label: 'Workspace',
      children: visibleWorkspacePanels.value
        .map((panel) => panel.node)
        .map(translateCategory)
    }),
    translateCategory({
      key: 'general',
      label: 'General',
      children: [
        translateCategory(userPanel.node),
        ...coreSettingCategories.value.slice(0, 1).map(translateCategory),
        ...(shouldShowSecretsPanel.value
          ? [translateCategory(secretsPanel.node)]
          : []),
        ...coreSettingCategories.value.slice(1).map(translateCategory),
        translateCategory(keybindingPanel.node),
        translateCategory(extensionPanel.node),
        translateCategory(aboutPanel.node),
        ...(isDesktop ? [translateCategory(serverConfigPanel.node)] : [])
      ]
    }),
    ...(customNodeSettingCategories.value.length > 0
      ? [
          translateCategory({
            key: 'other',
            label: 'Other',
            children: customNodeSettingCategories.value.map(translateCategory)
          })
        ]
      : [])
  ])

  const groupedMenuTreeNodes = workspaceMenuTreeNodes

  const navGroups = computed<NavGroupData[]>(() =>
    groupedMenuTreeNodes.value
      .filter((group) => group.children?.length)
      .map((group) => ({
        title:
          (group as SettingTreeNode & { translatedLabel?: string })
            .translatedLabel ?? group.label,
        items: (group.children ?? []).map((child) => ({
          id: child.key,
          label:
            (child as SettingTreeNode & { translatedLabel?: string })
              .translatedLabel ?? child.label,
          icon:
            child.key === 'workspace'
              ? CATEGORY_ICONS.PlanCredits
              : (CATEGORY_ICONS[child.key] ?? CATEGORY_ICONS[child.label]),
          ...(child.key === 'workspace-allowlist' &&
          governanceStore.status === 'ineligible' &&
          governanceStore.providers.length > 0
            ? { suffixIcon: 'icon-[lucide--crown]' }
            : {})
        }))
      }))
  )

  function findCategoryByKey(key: string): SettingTreeNode | null {
    for (const group of groupedMenuTreeNodes.value) {
      const found = group.children?.find((node) => node.key === key)
      if (found) return found
    }
    return null
  }

  function findPanelByKey(key: string): SettingPanelItem | null {
    return panels.value.find((p) => p.node.key === key) ?? null
  }

  onMounted(() => {
    activeCategory.value = defaultCategory.value
  })

  return {
    panels,
    activeCategory,
    defaultCategory,
    groupedMenuTreeNodes,
    settingCategories,
    navGroups,
    findCategoryByKey,
    findPanelByKey
  }
}
