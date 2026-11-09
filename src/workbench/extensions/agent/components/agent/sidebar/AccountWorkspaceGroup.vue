<script setup lang="ts">
import {
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup
} from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import MenuItem from '@comfyorg/design-system/menu/MenuItem'
import MenuRadioItem from '@comfyorg/design-system/menu/MenuRadioItem'
import { useWorkspaceDialogs } from '@/platform/account/composables/useWorkspaceDialogs'
import {
  canDesktopHostSwitchWorkspace,
  isDesktopHostSignedIn
} from '@/platform/auth/desktopHost/desktopHostSession'
import { useWorkspaceTierLabel } from '@/platform/billing/composables/useWorkspaceTierLabel'
import { useWorkspaceBillingStateStore } from '@/platform/billing/stores/workspaceBillingStateStore'
import { isCloud } from '@/platform/distribution/types'
import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useAgentAccount } from '@/workbench/extensions/agent/composables/agent/useAgentAccount'
import { trackAccountMenu } from './trackAccountMenu'

type Workspace = ReturnType<typeof useTeamWorkspaceStore>['workspaces'][number]

const { t } = useI18n()
const workspaceStore = useTeamWorkspaceStore()
const { switchWorkspace } = useWorkspaceSwitch()
const { getTierLabel } = useWorkspaceTierLabel()
const { activeWorkspace, planLabel } = useAgentAccount()
const billingState = useWorkspaceBillingStateStore()
const { showCreateWorkspaceDialog } = useWorkspaceDialogs()

const isWorkspaceFixed = computed(
  () => isDesktopHostSignedIn() && !canDesktopHostSwitchWorkspace()
)

function planOf(workspace: Workspace): string | undefined {
  if (workspace.type !== 'personal') return undefined
  if (workspace.id === activeWorkspace.value?.id) return planLabel.value
  return getTierLabel(billingState.getSummary(workspace)) || undefined
}

function roleAndPlan(workspace: Workspace): string {
  const role =
    workspace.role === 'owner'
      ? t('workspaceSwitcher.roleOwner')
      : t('workspaceSwitcher.roleMember')
  const plan = planOf(workspace)
  return plan ? `${role} · ${plan}` : role
}

function onSelectWorkspace(workspaceId: string): void {
  if (workspaceId === activeWorkspace.value?.id) return
  trackAccountMenu('agent_account_menu_workspace_switched')
  void switchWorkspace(workspaceId)
}

function onSelectCreate(): void {
  trackAccountMenu('agent_account_menu_workspace_create_clicked')
  void showCreateWorkspaceDialog()
}
</script>

<template>
  <template v-if="activeWorkspace">
    <DropdownMenuLabel class="px-3 py-1.5 text-xs text-muted-foreground">
      {{ t('agent.account.workspaces') }}
    </DropdownMenuLabel>
    <div
      v-if="isWorkspaceFixed"
      class="flex min-h-8 items-center gap-2 px-3 py-1.5 text-sm"
    >
      <WorkspaceProfilePic
        aria-hidden="true"
        class="shrink-0"
        :workspace-name="activeWorkspace.name"
        :subscription-tier="
          billingState.getSummary(activeWorkspace).subscriptionTier
        "
      />
      <span class="min-w-0 flex-1 truncate">{{ activeWorkspace.name }}</span>
    </div>
    <DropdownMenuRadioGroup
      v-else
      :model-value="activeWorkspace.id"
      :aria-label="t('agent.account.workspaces')"
      class="max-h-60 overflow-y-auto"
      @update:model-value="
        typeof $event === 'string' && onSelectWorkspace($event)
      "
    >
      <MenuRadioItem
        v-for="workspace in workspaceStore.workspaces"
        :key="workspace.id"
        :value="workspace.id"
        :disabled="workspaceStore.isSwitching"
      >
        <WorkspaceProfilePic
          aria-hidden="true"
          class="shrink-0"
          :workspace-name="workspace.name"
          :subscription-tier="
            billingState.getSummary(workspace).subscriptionTier
          "
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate">{{ workspace.name }}</span>
          <span class="truncate text-xs/4 text-muted-foreground">
            {{ roleAndPlan(workspace) }}
          </span>
        </span>
        <DropdownMenuItemIndicator class="flex shrink-0">
          <i aria-hidden="true" class="icon-[lucide--check]" />
        </DropdownMenuItemIndicator>
      </MenuRadioItem>
    </DropdownMenuRadioGroup>
    <p v-if="!isCloud" class="m-0 px-3 py-1.5 text-xs text-muted-foreground">
      {{ t('workspaceSwitcher.scopeCaption') }}
    </p>
    <template v-if="isCloud">
      <MenuItem
        v-if="workspaceStore.canCreateWorkspace"
        @select="onSelectCreate"
      >
        <span class="flex size-8 shrink-0 items-center justify-center">
          <i aria-hidden="true" class="icon-[lucide--plus]" />
        </span>
        <span class="min-w-0 flex-1 truncate">
          {{ t('agent.account.createWorkspace') }}
        </span>
      </MenuItem>
    </template>
  </template>
</template>
