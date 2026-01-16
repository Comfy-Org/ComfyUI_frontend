<template>
  <div class="flex w-80 flex-col overflow-hidden rounded-lg">
    <div class="flex flex-col overflow-y-auto">
      <template
        v-for="workspace in availableWorkspaces"
        :key="workspace.id ?? 'personal'"
      >
        <div class="border-b border-border-default p-2">
          <button
            :class="
              cn(
                'flex h-[54px] w-full cursor-pointer items-center gap-2 rounded px-2 py-4 border-none bg-transparent',
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
        </div>
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
import { useI18n } from 'vue-i18n'

import WorkspaceProfilePic from '@/components/common/WorkspaceProfilePic.vue'
import type { AvailableWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { cn } from '@/utils/tailwindUtil'

const emit = defineEmits<{
  select: [workspace: AvailableWorkspace]
  create: []
}>()

const { t } = useI18n()
const {
  workspaceId,
  availableWorkspaces,
  canCreateWorkspace,
  switchWorkspace
} = useWorkspace()

function isCurrentWorkspace(workspace: AvailableWorkspace): boolean {
  return workspace.id === workspaceId.value
}

function getRoleLabel(role: AvailableWorkspace['role']): string {
  if (role === 'owner') return t('workspaceSwitcher.roleOwner')
  if (role === 'member') return t('workspaceSwitcher.roleMember')
  return ''
}

function handleSelectWorkspace(workspace: AvailableWorkspace) {
  switchWorkspace(workspace)
  emit('select', workspace)
}

function handleCreateWorkspace() {
  emit('create')
}
</script>
