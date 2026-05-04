<template>
  <div
    class="flex w-[316px] flex-col overflow-hidden rounded-lg py-2 font-[Inter,Arial,sans-serif]"
  >
    <div class="flex flex-col gap-2 overflow-y-auto">
      <!-- Loading state -->
      <template v-if="isFetchingWorkspaces">
        <div
          v-for="i in 2"
          :key="i"
          class="flex h-[54px] animate-pulse items-center gap-2 rounded-lg px-4 py-2"
        >
          <div class="size-8 rounded-sm bg-secondary-background" />
          <div class="flex flex-1 flex-col gap-1">
            <div class="h-4 w-24 rounded-sm bg-secondary-background" />
            <div class="h-3 w-16 rounded-sm bg-secondary-background" />
          </div>
        </div>
      </template>

      <template v-else>
        <!-- All workspaces -->
        <div
          v-for="workspace in availableWorkspaces"
          :key="workspace.id"
          class="px-2"
        >
          <button
            :class="
              cn(
                'flex h-[54px] w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent p-2',
                'hover:bg-secondary-background-hover',
                isCurrentWorkspace(workspace) && 'bg-secondary-background'
              )
            "
            @click="handleSelectWorkspace(workspace)"
          >
            <WorkspaceProfilePic
              class="size-8 text-sm"
              :workspace-name="workspace.name"
            />
            <div class="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span class="text-left text-sm text-base-foreground">
                {{ workspace.name }}
              </span>
              <span class="text-left text-sm text-muted-foreground">
                {{ getRoleLabel(workspace) }}
              </span>
            </div>
            <i
              v-if="isCurrentWorkspace(workspace)"
              class="icon-[lucide--check] size-4 shrink-0 text-base-foreground"
            />
          </button>
        </div>

        <!-- Divider -->
        <div class="border-t border-border-default" />

        <!-- Create workspace button -->
        <div class="px-2">
          <button
            :class="
              cn(
                'flex w-full items-center gap-2 rounded-lg border-none bg-transparent p-2',
                canCreateWorkspace
                  ? 'cursor-pointer hover:bg-secondary-background-hover'
                  : 'cursor-default opacity-50'
              )
            "
            :disabled="!canCreateWorkspace"
            @click="canCreateWorkspace && handleCreateWorkspace()"
          >
            <div
              class="flex size-8 items-center justify-center rounded-full bg-secondary-background"
            >
              <i class="icon-[lucide--plus] size-4 text-muted-foreground" />
            </div>
            <span class="text-left text-sm text-base-foreground">
              {{
                canCreateWorkspace
                  ? $t('workspaceSwitcher.createWorkspace')
                  : $t('workspaceSwitcher.maxWorkspacesReached')
              }}
            </span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/platform/workspace/components/WorkspaceProfilePic.vue'
import { useWorkspaceSwitch } from '@/platform/workspace/composables/useWorkspaceSwitch'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { cn } from '@comfyorg/tailwind-utils'

interface AvailableWorkspace {
  id: string
  name: string
  role: WorkspaceRole
}

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
}>()

const { t } = useI18n()
const { switchWorkspace } = useWorkspaceSwitch()

const workspaceStore = useTeamWorkspaceStore()
const { workspaceId, workspaces, canCreateWorkspace, isFetchingWorkspaces } =
  storeToRefs(workspaceStore)

const availableWorkspaces = computed<AvailableWorkspace[]>(() =>
  workspaces.value.map((w) => ({
    id: w.id,
    name: w.name,
    role: w.role
  }))
)

function isCurrentWorkspace(workspace: AvailableWorkspace): boolean {
  return workspace.id === workspaceId.value
}

function getRoleLabel(workspace: AvailableWorkspace): string {
  if (workspace.role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (workspace.role === 'member') return t('workspaceSwitcher.roleMember')
  return ''
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
