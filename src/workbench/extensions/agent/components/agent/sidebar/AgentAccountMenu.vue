<script setup lang="ts">
import {
  DropdownMenuLabel,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import UserAvatar from '@comfyorg/design-system/common/UserAvatar'
import Button from '@comfyorg/design-system/button/Button'
import MenuContent from '@comfyorg/design-system/menu/MenuContent'
import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuSeparator from '@comfyorg/design-system/menu/MenuSeparator'
import Skeleton from '@comfyorg/design-system/skeleton/Skeleton'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useSubscriptionDialog } from '@/platform/billing/subscription/composables/useSubscriptionDialog'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { platformLink } from '@/platform/workspace/utils/platformLink'
import { useCommandStore } from '@/platform/keybindings/commandStore'

import { useAgentAccount } from '@/workbench/extensions/agent/composables/agent/useAgentAccount'
import AccountLanguageSubmenu from './AccountLanguageSubmenu.vue'
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
    .map((group) => group.filter(([, shown]) => shown).map(([entry]) => entry))
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
        <template v-if="!compact">
          <span
            v-if="activeWorkspace"
            class="flex min-w-0 flex-1 flex-col text-left"
          >
            <span class="truncate">{{ activeWorkspace.name }}</span>
            <span
              v-if="planLabel"
              class="truncate text-xs/4 text-muted-foreground"
            >
              {{ planLabel }}
            </span>
          </span>
          <span v-else class="min-w-0 flex-1 truncate text-left">
            <span>{{ firstName ?? t('agent.account.fallbackName') }}</span>
            <span v-if="planLabel" class="text-muted-foreground">
              · {{ planLabel }}
            </span>
          </span>
          <i
            aria-hidden="true"
            class="icon-[lucide--chevron-down] text-muted-foreground"
          />
        </template>
      </Button>
    </DropdownMenuTrigger>
    <MenuContent
      side="bottom"
      align="start"
      :side-offset="4"
      width="trigger"
      class="agent-scope min-w-64 overflow-y-auto"
    >
      <template v-for="(group, index) in groups" :key="group[0]">
        <MenuSeparator v-if="index > 0" />
        <template v-for="entry in group" :key="entry">
          <AccountWorkspaceGroup v-if="entry === 'workspaces'" />
          <MenuItem
            v-else-if="entry === 'workspaceSettings'"
            @select="onSelectWorkspaceSettings"
          >
            <i aria-hidden="true" class="icon-[lucide--users]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.workspaceSettings') }}
            </span>
          </MenuItem>
          <DropdownMenuLabel
            v-else-if="entry === 'email'"
            class="truncate px-3 py-1.5 text-xs text-muted-foreground"
          >
            {{ email }}
          </DropdownMenuLabel>
          <MenuItem
            v-else-if="entry === 'settings'"
            :aria-keyshortcuts="settingsAriaShortcut"
            @select="onSelectSettings"
          >
            <i aria-hidden="true" class="icon-[lucide--settings]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.settings') }}
            </span>
            <span
              v-if="settingsCombo"
              aria-hidden="true"
              class="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-xs/4 text-muted-foreground"
            >
              {{ settingsCombo.toString() }}
            </span>
          </MenuItem>
          <MenuItem v-else-if="entry === 'usage'" @select="onSelectUsage">
            <i aria-hidden="true" class="icon-[lucide--chart-column]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.usage') }}
            </span>
            <Skeleton
              v-if="isBalanceLoading"
              data-testid="agent-account-balance-loading"
              class="h-4 w-10 shrink-0 bg-accent"
            />
            <template v-else-if="creditBalance !== undefined">
              <span
                aria-hidden="true"
                class="shrink-0 text-xs text-muted-foreground"
              >
                {{ creditBalance }}
              </span>
              <span class="sr-only">
                {{
                  t('agent.account.creditBalance', { credits: creditBalance })
                }}
              </span>
            </template>
          </MenuItem>
          <AccountLanguageSubmenu v-else-if="entry === 'language'" />
          <MenuItem v-else-if="entry === 'help'" @select="onSelectHelp">
            <i aria-hidden="true" class="icon-[lucide--circle-help]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.getHelp') }}
            </span>
          </MenuItem>
          <MenuItem v-else-if="entry === 'plans'" @select="onSelectPlans">
            <i aria-hidden="true" class="icon-[lucide--receipt-text]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.viewAllPlans') }}
            </span>
          </MenuItem>
          <MenuItem v-else-if="entry === 'apiKey'" @select="onSelectApiKey">
            <i aria-hidden="true" class="icon-[lucide--key-round]" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate">
                {{ t('agent.account.getApiKey') }}
              </span>
              <span class="truncate text-xs/4 text-muted-foreground">
                {{ t('agent.account.getApiKeyHint') }}
              </span>
            </span>
            <i
              aria-hidden="true"
              class="icon-[lucide--external-link] text-muted-foreground"
            />
            <span class="sr-only">
              {{ t('agent.account.opensInNewTab') }}
            </span>
          </MenuItem>
          <MenuItem v-else @select="onSelectLogOut">
            <i aria-hidden="true" class="icon-[lucide--log-out]" />
            <span class="min-w-0 flex-1 truncate">
              {{ t('agent.account.logOut') }}
            </span>
          </MenuItem>
        </template>
      </template>
    </MenuContent>
  </DropdownMenuRoot>
</template>
