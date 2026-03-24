<template>
  <div class="flex w-80 flex-col overflow-hidden rounded-lg">
    <div class="flex flex-col overflow-y-auto">
      <!-- Loading state -->
      <div v-if="isFetchingWorkspaces" class="flex flex-col gap-2 p-2">
        <div
          v-for="i in 2"
          :key="i"
          class="flex h-[54px] animate-pulse items-center gap-2 rounded-sm px-2 py-4"
        >
          <div class="size-8 rounded-full bg-secondary-background" />
          <div class="flex flex-1 flex-col gap-1">
            <div class="h-4 w-24 rounded-sm bg-secondary-background" />
            <div class="h-3 w-16 rounded-sm bg-secondary-background" />
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
                  'group flex h-[54px] w-full items-center gap-2 rounded-sm px-2 py-4',
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
                      v-if="resolveTierLabel(workspace)"
                      class="rounded-full bg-base-foreground px-1 py-0.5 text-[10px] font-bold text-base-background uppercase"
                    >
                      {{ resolveTierLabel(workspace) }}
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
      <div class="p-2">
        <div
          :class="
            cn(
              'flex h-12 w-full items-center gap-2 rounded-sm p-2',
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

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import { useWorkspaceTierLabel } from '@/platform/workspace/composables/useWorkspaceTierLabel'
import type {
  SubscriptionTier,
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@/utils/tailwindUtil'

interface AvailableWorkspace {
  id: string
  name: string
  type: WorkspaceType
  role: WorkspaceRole
  isSubscribed: boolean
  subscriptionPlan: string | null
  subscriptionTier: SubscriptionTier | null
}

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
}>()

const { t } = useI18n()
const { switchWorkspace } = useWorkspaceSwitch()
const { subscription } = useBillingContext()
const { formatTierName, getTierLabel } = useWorkspaceTierLabel()

const currentSubscriptionTierName = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return ''
  const isYearly = subscription.value?.duration === 'ANNUAL'
  return formatTierName(tier, isYearly)
})

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
    subscriptionPlan: w.subscriptionPlan,
    subscriptionTier: w.subscriptionTier
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

function resolveTierLabel(workspace: AvailableWorkspace): string | null {
  if (isCurrentWorkspace(workspace)) {
    return currentSubscriptionTierName.value || null
  }

  return getTierLabel(workspace)
}

async function handleSelectWorkspace(workspace: AvailableWorkspace) {
  const success = await switchWorkspace(workspace.id)
  if (success) {
    emit('select', workspace)
  }
}

function handleCreateWorkspace() {
  emit('create')
}
</script>
