<template>
  <AppDialogPanel size="compact" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.leaveDialog.title') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.leaveDialog.message') }}
    </p>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onLeave">
        {{ $t('workspacePanel.leaveDialog.leave') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'

const { t } = useI18n()
const toast = useToast()
const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'leave-workspace' })
}

async function onLeave() {
  loading.value = true
  try {
    // leaveWorkspace() handles switching to personal workspace internally and reloads
    await workspaceStore.leaveWorkspace()
    dialogStore.closeDialog({ key: 'leave-workspace' })
    window.location.reload()
  } catch (error) {
    console.error('[LeaveWorkspaceDialog] Failed to leave workspace:', error)
    toast.error(t('workspacePanel.toast.failedToLeaveWorkspace'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  } finally {
    loading.value = false
  }
}
</script>
