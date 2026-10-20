<template>
  <DialogPanel class="w-full max-w-[360px]" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.deleteDialog.title') }}
    </template>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{
          workspaceName
            ? $t('workspacePanel.deleteDialog.messageWithName', {
                name: workspaceName
              })
            : $t('workspacePanel.deleteDialog.message')
        }}
      </p>
    </div>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onDelete">
        {{ $t('g.delete') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import { useToast } from '@/components/ui/toast/toastStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'

const { workspaceId, workspaceName } = defineProps<{
  workspaceId?: string
  workspaceName?: string
}>()

const { t } = useI18n()
const toast = useToast()
const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'delete-workspace' })
}

async function onDelete() {
  loading.value = true
  try {
    // Delete workspace (uses workspaceId if provided, otherwise current workspace)
    await workspaceStore.deleteWorkspace(workspaceId)
    dialogStore.closeDialog({ key: 'delete-workspace' })
    window.location.reload()
  } catch (error) {
    console.error('[DeleteWorkspaceDialog] Failed to delete workspace:', error)
    toast.error(t('workspacePanel.toast.failedToDeleteWorkspace'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  } finally {
    loading.value = false
  }
}
</script>
