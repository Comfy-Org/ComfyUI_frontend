<template>
  <div
    class="flex w-full max-w-[360px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{
          $t('workspacePanel.changeRoleDialog.title', {
            name: memberName
          })
        }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="px-4 py-4">
      <p class="m-0 mb-4 text-sm text-muted-foreground">
        {{ $t('workspacePanel.changeRoleDialog.selectNewRole') }}
      </p>

      <div role="radiogroup" class="flex flex-col gap-2">
        <label
          v-for="option in roleOptions"
          :key="option.value"
          :class="
            cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
              selectedRole === option.value
                ? 'border-secondary-foreground bg-secondary-background/50'
                : 'border-border-default hover:bg-secondary-background/30'
            )
          "
        >
          <input
            type="radio"
            name="workspace-role"
            :value="option.value"
            :checked="selectedRole === option.value"
            class="mt-0.5 size-4 shrink-0 cursor-pointer accent-secondary-foreground"
            @change="selectedRole = option.value"
          />
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-medium text-base-foreground">
              {{ option.label }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ option.description }}
            </span>
          </div>
        </label>
      </div>
    </div>

    <!-- Footer -->
    <div
      class="flex items-center justify-end gap-4 border-t border-border-default px-4 py-4"
    >
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="lg"
        :loading
        :disabled="selectedRole === currentRole"
        @click="onChangeRole"
      >
        {{ $t('workspacePanel.changeRoleDialog.changeRole') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@/utils/tailwindUtil'

const { memberId, memberName, currentRole } = defineProps<{
  memberId: string
  memberName: string
  currentRole: WorkspaceRole
}>()

const { t } = useI18n()
const toast = useToast()
const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const loading = ref(false)
const selectedRole = ref<WorkspaceRole>(currentRole)

const roleOptions = [
  {
    value: 'owner' as WorkspaceRole,
    label: t('workspacePanel.changeRoleDialog.roles.owner.label'),
    description: t('workspacePanel.changeRoleDialog.roles.owner.description')
  },
  {
    value: 'member' as WorkspaceRole,
    label: t('workspacePanel.changeRoleDialog.roles.member.label'),
    description: t('workspacePanel.changeRoleDialog.roles.member.description')
  }
]

function onCancel() {
  dialogStore.closeDialog({ key: 'change-role' })
}

async function onChangeRole() {
  if (selectedRole.value === currentRole) return

  loading.value = true
  try {
    await workspaceStore.updateMemberRole(memberId, selectedRole.value)
    dialogStore.closeDialog({ key: 'change-role' })
  } catch (error) {
    console.error('[ChangeRoleDialog] Failed to change role:', error)
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.changeRoleDialog.error'),
      detail: error instanceof Error ? error.message : t('g.unknownError'),
      life: 5000
    })
  } finally {
    loading.value = false
  }
}
</script>
