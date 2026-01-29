<template>
  <div class="flex w-80 flex-col overflow-hidden rounded-lg">
    <div class="flex flex-col overflow-y-auto">
      <!-- Loading state -->
      <div v-if="isFetchingWorkspaces" class="flex flex-col gap-2 p-2">
        <div
          v-for="i in 2"
          :key="i"
          class="flex h-[54px] animate-pulse items-center gap-2 rounded px-2 py-4"
        >
          <div class="size-8 rounded-full bg-secondary-background" />
          <div class="flex flex-1 flex-col gap-1">
            <div class="h-4 w-24 rounded bg-secondary-background" />
            <div class="h-3 w-16 rounded bg-secondary-background" />
          </div>
        </div>
      </div>

      <!-- Workspace list -->
      <template v-else>
        <template v-for="workspace in availableWorkspaces" :key="workspace.id">
          <div class="border-b border-border-default p-2">
            <div
              :class="
                cn(
                  'group flex h-[54px] w-full items-center gap-2 rounded px-2 py-4',
                  'hover:bg-secondary-background-hover',
                  isCurrentWorkspace(workspace) && 'bg-secondary-background'
                )
              "
            >
              <button
                class="flex flex-1 cursor-pointer items-center gap-2 border-none bg-transparent p-0"
                @click="handleSelectWorkspace(workspace)"
              >
                <WorkspaceProfilePic
                  class="size-8 text-sm"
                  :workspace-name="workspace.name"
                />
                <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm text-base-foreground">
                      {{
                        workspace.type === 'personal'
                          ? $t('workspaceSwitcher.personal')
                          : workspace.name
                      }}
                    </span>
                    <span
                      v-if="getTierLabel(workspace)"
                      class="text-[10px] font-bold uppercase text-base-background bg-base-foreground px-1 py-0.5 rounded-full"
                    >
                      {{ getTierLabel(workspace) }}
                    </span>
                  </div>
                  <span class="text-xs text-muted-foreground">
                    {{ getRoleLabel(workspace.role) }}
                  </span>
                </div>
                <i
                  v-if="isCurrentWorkspace(workspace)"
                  class="pi pi-check text-sm text-base-foreground"
                />
              </button>
            </div>
          </div>
        </template>
      </template>

      <!-- Create workspace button -->
      <div class="px-2 py-2">
        <div
          :class="
            cn(
              'flex h-12 w-full items-center gap-2 rounded px-2 py-2',
              canCreateWorkspace
                ? 'cursor-pointer hover:bg-secondary-background-hover'
                : 'cursor-default'
            )
          "
          @click="canCreateWorkspace && handleCreateWorkspace()"
        >
          <div
            :class="
              cn(
                'flex size-8 items-center justify-center rounded-full bg-secondary-background',
                !canCreateWorkspace && 'opacity-50'
              )
            "
          >
            <i class="pi pi-plus text-sm text-muted-foreground" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col">
            <span
              v-if="canCreateWorkspace"
              class="text-sm text-muted-foreground"
            >
              {{ $t('workspaceSwitcher.createWorkspace') }}
            </span>
            <span v-else class="text-sm text-muted-foreground">
              {{ $t('workspaceSwitcher.maxWorkspacesReached') }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import { useWorkspaceSwitch } from '@/platform/auth/workspace/useWorkspaceSwitch'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

type SubscriptionPlan = 'PRO_MONTHLY' | 'PRO_YEARLY' | null

interface AvailableWorkspace {
  id: string
  name: string
  type: WorkspaceType
  role: WorkspaceRole
  isSubscribed: boolean
  subscriptionPlan: SubscriptionPlan
}

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
}>()

const { t } = useI18n()
const { switchWithConfirmation } = useWorkspaceSwitch()
const { subscriptionTierName: userSubscriptionTierName } = useSubscription()

const workspaceStore = useTeamWorkspaceStore()
const { workspaceId, workspaces, canCreateWorkspace, isFetchingWorkspaces } =
  storeToRefs(workspaceStore)

const availableWorkspaces = computed<AvailableWorkspace[]>(() =>
  workspaces.value.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    role: w.role,
    isSubscribed: w.isSubscribed,
    subscriptionPlan: w.subscriptionPlan
  }))
)

function isCurrentWorkspace(workspace: AvailableWorkspace): boolean {
  return workspace.id === workspaceId.value
}

function getRoleLabel(role: AvailableWorkspace['role']): string {
  if (role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (role === 'member') return t('workspaceSwitcher.roleMember')
  return ''
}

function getTierLabel(workspace: AvailableWorkspace): string | null {
  // Personal workspace: use user's subscription tier
  if (workspace.type === 'personal') {
    return userSubscriptionTierName.value || null
  }
  // Team workspace: use workspace subscription plan
  if (!workspace.isSubscribed || !workspace.subscriptionPlan) return null
  if (workspace.subscriptionPlan === 'PRO_MONTHLY')
    return t('subscription.tiers.pro.name')
  if (workspace.subscriptionPlan === 'PRO_YEARLY')
    return t('subscription.tierNameYearly', {
      name: t('subscription.tiers.pro.name')
    })
  return null
}

async function handleSelectWorkspace(workspace: AvailableWorkspace) {
  const success = await switchWithConfirmation(workspace.id)
  if (success) {
    emit('select', workspace)
  }
}

function handleCreateWorkspace() {
  emit('create')
}
</script>
