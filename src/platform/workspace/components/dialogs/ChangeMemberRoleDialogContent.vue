<template>
  <div
    class="flex w-full max-w-90 flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{
          isPromotion
            ? $t('workspacePanel.changeRoleDialog.promoteTitle', {
                name: memberName
              })
            : $t('workspacePanel.changeRoleDialog.demoteTitle', {
                name: memberName
              })
        }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground -m-1 cursor-pointer rounded-sm border-none bg-transparent p-1 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="p-4">
      <template v-if="isPromotion">
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.changeRoleDialog.promoteIntro') }}
        </p>
        <ul class="m-0 mt-1 list-disc ps-5 text-sm text-muted-foreground">
          <li v-for="permission in promotePermissions" :key="permission">
            {{ permission }}
          </li>
        </ul>
      </template>
      <p v-else class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.changeRoleDialog.demoteMessage') }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 p-4">
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="secondary" size="lg" :loading @click="onConfirm">
        {{
          isPromotion
            ? $t('workspacePanel.changeRoleDialog.promoteConfirm')
            : $t('workspacePanel.changeRoleDialog.demoteConfirm')
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { WorkspaceRole } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

const { memberId, targetRole } = defineProps<{
  memberId: string
  memberName: string
  targetRole: WorkspaceRole
}>()

const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const toast = useToast()
const { t } = useI18n()
const loading = ref(false)

const isPromotion = computed(() => targetRole === 'owner')

const promotePermissions = computed(() => [
  t('workspacePanel.changeRoleDialog.promotePermissionCredits'),
  t('workspacePanel.changeRoleDialog.promotePermissionManage'),
  t('workspacePanel.changeRoleDialog.promotePermissionRoles')
])

function onCancel() {
  dialogStore.closeDialog({ key: 'change-member-role' })
}

async function onConfirm() {
  loading.value = true
  try {
    await workspaceStore.changeMemberRole(memberId, targetRole)
    toast.add({
      severity: 'success',
      summary: t('workspacePanel.changeRoleDialog.success'),
      life: 2000
    })
    dialogStore.closeDialog({ key: 'change-member-role' })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.changeRoleDialog.error')
    })
  } finally {
    loading.value = false
  }
}
</script>
