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
                  <span class="text-sm text-base-foreground">
                    {{ workspace.name }}
                  </span>
                  <span
                    v-if="workspace.type !== 'personal'"
                    class="text-sm text-muted-foreground"
                  >
                    {{ getRoleLabel(workspace.role) }}
                  </span>
                </div>
                <i
                  v-if="isCurrentWorkspace(workspace)"
                  class="pi pi-check text-sm text-base-foreground"
                />
              </button>
              <!-- Delete button - only for team workspaces where user is owner -->
              <button
                v-if="canDeleteWorkspace(workspace)"
                class="flex size-6 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted-foreground opacity-0 transition-opacity hover:bg-error-background hover:text-error-foreground group-hover:opacity-100"
                :title="$t('g.delete')"
                @click.stop="handleDeleteWorkspace(workspace)"
              >
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
          </div>
        </template>
      </template>

      <!-- <Divider class="mx-0 my-0" /> -->

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
import type {
  WorkspaceRole,
  WorkspaceType
} from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@/utils/tailwindUtil'

interface AvailableWorkspace {
  id: string
  name: string
  type: WorkspaceType
  role: WorkspaceRole
}

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
  delete: [workspace: AvailableWorkspace]
}>()

const { t } = useI18n()
const { switchWithConfirmation } = useWorkspaceSwitch()
const { showDeleteWorkspaceDialog } = useDialogService()
const workspaceStore = useTeamWorkspaceStore()
const { workspaceId, workspaces, canCreateWorkspace, isFetchingWorkspaces } =
  storeToRefs(workspaceStore)

const availableWorkspaces = computed<AvailableWorkspace[]>(() =>
  workspaces.value.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
    role: w.role
  }))
)

// Workspace store is initialized in router.ts before the app loads
// This component just displays the already-loaded workspace data

function isCurrentWorkspace(workspace: AvailableWorkspace): boolean {
  return workspace.id === workspaceId.value
}

function getRoleLabel(role: AvailableWorkspace['role']): string {
  if (role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (role === 'member') return t('workspaceSwitcher.roleMember')
  return ''
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

function canDeleteWorkspace(workspace: AvailableWorkspace): boolean {
  // Can only delete team workspaces where user is owner
  return workspace.type === 'team' && workspace.role === 'owner'
}

function handleDeleteWorkspace(workspace: AvailableWorkspace) {
  showDeleteWorkspaceDialog({
    workspaceId: workspace.id,
    workspaceName: workspace.name
  })
  emit('delete', workspace)
}
</script>
