<script setup lang="ts">
import { DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import UserAvatar from '@comfyorg/design-system/common/UserAvatar'
import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { isCloud } from '@/platform/distribution/types'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { platformLink } from '@/platform/workspace/utils/platformLink'
import { useCommandStore } from '@/platform/keybindings/commandStore'

import { useAgentAccount } from '@/workbench/extensions/agent/composables/agent/useAgentAccount'
import AccountApiKeyItem from './AccountApiKeyItem.vue'
import AccountEmailLabel from './AccountEmailLabel.vue'
import AccountLanguageSubmenu from './AccountLanguageSubmenu.vue'
import AccountMenuAction from './AccountMenuAction.vue'
import AccountMenuTriggerLabel from './AccountMenuTriggerLabel.vue'
import AccountUsageItem from './AccountUsageItem.vue'
import AccountWorkspaceGroup from './AccountWorkspaceGroup.vue'
import { trackAccountMenu } from './trackAccountMenu'

const { compact = false } = defineProps<{
  compact?: boolean
}>()

const { t } = useI18n()
const billingState = useWorkspaceBillingStateStore()
const {
  firstName,
  initials,
  email,
  planLabel,
  creditBalance,
  isBalanceLoading,
  refreshBalance,
  isLoggedIn,
  canViewPlans,
  activeWorkspace
} = useAgentAccount()
const { handleSignOut } = useCurrentUser()
const commandStore = useCommandStore()
const keybindingStore = useKeybindingStore()
const settingsDialog = useSettingsDialog()
const subscriptionDialog = useSubscriptionDialog()

const SETTINGS_COMMAND = 'Comfy.ShowSettingsDialog'

const ARIA_KEY_NAMES: Record<string, string> = { ' ': 'Space', '+': 'Plus' }

const settingsCombo = computed(
  () => keybindingStore.getKeybindingByCommandId(SETTINGS_COMMAND)?.combo
)

const settingsAriaShortcut = computed(() => {
  const combo = settingsCombo.value
  if (!combo) return undefined
  return [
    combo.ctrl && 'Control',
    combo.alt && 'Alt',
    combo.shift && 'Shift',
    ARIA_KEY_NAMES[combo.key] ?? combo.key
  ]
    .filter(Boolean)
    .join('+')
})

type AccountMenuEntry =
  | 'workspaces'
  | 'workspaceSettings'
  | 'usage'
  | 'plans'
  | 'email'
  | 'settings'
  | 'language'
  | 'help'
  | 'apiKey'
  | 'logout'

interface AccountMenuEntryView {
  component: Component
  props?: Record<string, unknown>
}

function action(
  icon: string,
  label: string,
  onSelect: () => void
): AccountMenuEntryView {
  return { component: AccountMenuAction, props: { icon, label, onSelect } }
}

function plansEntry(): AccountMenuEntryView {
  return isCloud
    ? action(
        'icon-[lucide--receipt-text]',
        t('agent.account.viewAllPlans'),
        onSelectPlans
      )
    : action(
        'icon-[lucide--coins]',
        t('subscription.plansAndCredits'),
        onSelectPlansAndCredits
      )
}

const entryViews = computed(
  (): Record<AccountMenuEntry, AccountMenuEntryView> => ({
    workspaces: { component: AccountWorkspaceGroup },
    workspaceSettings: action(
      'icon-[lucide--users]',
      t('agent.account.workspaceSettings'),
      onSelectWorkspaceSettings
    ),
    usage: {
      component: AccountUsageItem,
      props: {
        creditBalance: creditBalance.value,
        loading: isBalanceLoading.value,
        onSelect: onSelectUsage
      }
    },
    plans: plansEntry(),
    email: { component: AccountEmailLabel, props: { email: email.value } },
    settings: {
      component: AccountMenuAction,
      props: {
        icon: 'icon-[lucide--settings]',
        label: t('agent.account.settings'),
        shortcut: settingsCombo.value?.toString(),
        'aria-keyshortcuts': settingsAriaShortcut.value,
        onSelect: onSelectSettings
      }
    },
    language: { component: AccountLanguageSubmenu },
    help: action(
      'icon-[lucide--circle-help]',
      t('agent.account.getHelp'),
      onSelectHelp
    ),
    apiKey: {
      component: AccountApiKeyItem,
      props: { onSelect: onSelectApiKey }
    },
    logout: action(
      'icon-[lucide--log-out]',
      t('agent.account.logOut'),
      onSelectLogOut
    )
  })
)

const groups = computed(() => {
  const order: [entry: AccountMenuEntry, shown: boolean][][] = [
    [['workspaces', activeWorkspace.value !== undefined]],
    [
      ['workspaceSettings', isLoggedIn.value],
      ['usage', isLoggedIn.value],
      ['plans', canViewPlans.value]
    ],
    [
      ['email', email.value !== undefined],
      ['settings', true],
      ['language', true],
      ['help', true]
    ],
    [
      ['apiKey', true],
      ['logout', isLoggedIn.value]
    ]
  ]
  return order
    .map((group) =>
      group
        .filter(([, shown]) => shown)
        .map(([entry]) => ({ key: entry, ...entryViews.value[entry] }))
    )
    .filter((group) => group.length > 0)
})

function onOpenChange(open: boolean): void {
  if (!open) return
  refreshBalance()
  trackAccountMenu('agent_account_menu_opened')
}

function onSelectWorkspaceSettings(): void {
  trackAccountMenu('agent_account_menu_workspace_settings_clicked')
  settingsDialog.show('workspace')
}

function onSelectSettings(): void {
  trackAccountMenu('agent_account_menu_settings_clicked')
  void commandStore.execute(SETTINGS_COMMAND)
}

function onSelectUsage(): void {
  trackAccountMenu('agent_account_menu_usage_clicked')
  settingsDialog.show('workspace', undefined, { planCreditsView: 'overview' })
}

function onSelectHelp(): void {
  trackAccountMenu('agent_account_menu_help_clicked')
  void commandStore.execute('Comfy.ContactSupport')
}

function onSelectPlans(): void {
  trackAccountMenu('agent_account_menu_plans_clicked')
  subscriptionDialog.showPricingTable({ reason: 'avatar_menu_plans' })
}

function onSelectPlansAndCredits(): void {
  trackAccountMenu('agent_account_menu_plans_clicked')
  settingsDialog.show('workspace')
}

function onSelectApiKey(): void {
  trackAccountMenu('agent_account_menu_api_key_clicked')
  window.open(
    platformLink('/profile/api-keys'),
    '_blank',
    'noopener,noreferrer'
  )
}

function onSelectLogOut(): void {
  trackAccountMenu('agent_account_menu_logout_clicked')
  void handleSignOut()
}
</script>

<template>
  <DropdownMenuRoot @update:open="onOpenChange">
    <DropdownMenuTrigger as-child>
      <Button
        variant="textonly"
        size="unset"
        :aria-label="t('agent.account.menu')"
        :class="
          cn(
            'h-12 rounded-lg p-2 font-normal data-[state=open]:bg-accent',
            compact ? 'w-12 justify-center' : 'w-full justify-start',
            activeWorkspace &&
              !compact &&
              'box-border border border-solid border-border/50 py-1'
          )
        "
      >
        <WorkspaceProfilePic
          v-if="activeWorkspace"
          aria-hidden="true"
          class="shrink-0"
          :workspace-name="activeWorkspace.name"
          :subscription-tier="
            billingState.getSummary(activeWorkspace).subscriptionTier
          "
        />
        <UserAvatar
          v-else
          :label="t('auth.login.userAvatar')"
          :initials
          class="shrink-0"
        />
        <AccountMenuTriggerLabel
          v-if="!compact"
          :workspace-name="activeWorkspace?.name"
          :first-name
          :plan-label
        />
      </Button>
    </DropdownMenuTrigger>
    <MenuContent
      side="bottom"
      align="start"
      :side-offset="4"
      width="trigger"
      class="agent-scope min-w-64 overflow-y-auto"
    >
      <template v-for="(group, index) in groups" :key="group[0].key">
        <MenuSeparator v-if="index > 0" />
        <component
          :is="entry.component"
          v-for="entry in group"
          :key="entry.key"
          v-bind="entry.props"
        />
      </template>
    </MenuContent>
  </DropdownMenuRoot>
</template>
