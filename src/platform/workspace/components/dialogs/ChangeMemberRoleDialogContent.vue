<template>
  <AppDialogPanel
    size="compact"
    body-class="text-sm text-muted-foreground"
    @close="onCancel"
  >
    <template #title>
      {{
        isPromotion
          ? $t('workspacePanel.changeRoleDialog.promoteTitle', {
              name: memberName
            })
          : $t('workspacePanel.changeRoleDialog.demoteTitle', {
              name: memberName
            })
      }}
    </template>

    <template v-if="isPromotion">
      <p class="m-0">
        {{ $t('workspacePanel.changeRoleDialog.promoteIntro') }}
      </p>
      <ul class="m-0 mt-1 list-disc ps-5">
        <li v-for="permission in promotePermissions" :key="permission">
          {{ permission }}
        </li>
      </ul>
    </template>
    <p v-else class="m-0">
      {{ $t('workspacePanel.changeRoleDialog.demoteMessage') }}
    </p>

    <template #footer>
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
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
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
    toast.success(t('workspacePanel.changeRoleDialog.success'), {
      duration: 2000
    })
    dialogStore.closeDialog({ key: 'change-member-role' })
  } catch {
    toast.error(t('workspacePanel.changeRoleDialog.error'))
  } finally {
    loading.value = false
  }
}
</script>
