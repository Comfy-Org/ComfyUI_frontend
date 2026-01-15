<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { WorkspaceRole, WorkspaceWithRole } from '@/types/workspaceTypes'
import { cn } from '@/utils/tailwindUtil'

const { workspaces, currentWorkspaceId, isLoading } = defineProps<{
  workspaces: WorkspaceWithRole[]
  currentWorkspaceId: string | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  select: [workspaceId: string]
}>()

const { t } = useI18n()

const sortedWorkspaces = computed(() => {
  return [...workspaces].sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1
    if (a.role !== 'owner' && b.role === 'owner') return 1
    return a.name.localeCompare(b.name)
  })
})

function getRoleBadgeClass(role: WorkspaceRole): string {
  switch (role) {
    case 'owner':
      return 'bg-emerald-500/20 text-emerald-400'
    case 'member':
      return 'bg-blue-500/20 text-blue-400'
  }
}

function handleWorkspaceClick(workspace: WorkspaceWithRole): void {
  if (workspace.id !== currentWorkspaceId) {
    emit('select', workspace.id)
  }
}
</script>

<template>
  <div class="flex flex-col w-64 max-h-80">
    <div class="px-3 py-2 border-b border-border-subtle">
      <span class="text-sm font-medium text-muted-foreground">
        {{ t('workspace.selector.title') }}
      </span>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <i class="pi pi-spin pi-spinner text-muted-foreground" />
      <span class="ml-2 text-sm text-muted-foreground">
        {{ t('workspace.selector.loading') }}
      </span>
    </div>

    <div
      v-else-if="workspaces.length === 0"
      class="flex items-center justify-center py-8"
    >
      <span class="text-sm text-muted-foreground">
        {{ t('workspace.selector.noWorkspaces') }}
      </span>
    </div>

    <div v-else class="flex flex-col py-1 overflow-y-auto">
      <Button
        v-for="workspace in sortedWorkspaces"
        :key="workspace.id"
        variant="textonly"
        :class="
          cn(
            'flex items-center justify-between w-full px-3 py-2 text-left rounded-none',
            workspace.id === currentWorkspaceId &&
              'bg-secondary-background-hover'
          )
        "
        @click="handleWorkspaceClick(workspace)"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <i
            :class="
              cn(
                'icon-[lucide--building-2] text-base shrink-0',
                workspace.id === currentWorkspaceId
                  ? 'text-base-foreground'
                  : 'text-muted-foreground'
              )
            "
          />
          <span
            :class="
              cn(
                'text-sm truncate',
                workspace.id === currentWorkspaceId
                  ? 'text-base-foreground font-medium'
                  : 'text-muted-foreground'
              )
            "
          >
            {{ workspace.name }}
          </span>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <span
            :class="
              cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                getRoleBadgeClass(workspace.role)
              )
            "
          >
            {{ t(`workspace.roles.${workspace.role}`) }}
          </span>
          <i
            v-if="workspace.id === currentWorkspaceId"
            class="icon-[lucide--check] text-emerald-400 text-sm"
          />
        </div>
      </Button>
    </div>
  </div>
</template>
