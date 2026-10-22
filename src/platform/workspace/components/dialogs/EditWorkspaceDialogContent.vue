<template>
  <AppDialogPanel
    body-class="flex flex-col gap-4"
    class="max-w-none min-w-100"
    @close="onCancel"
  >
    <template #title>
      {{ $t('workspacePanel.editWorkspaceDialog.title') }}
    </template>

    <div class="flex flex-col gap-2 text-sm">
      <label>
        {{ $t('workspacePanel.editWorkspaceDialog.nameLabel') }}
      </label>
      <input
        v-model="newWorkspaceName"
        type="text"
        class="w-full rounded-lg border bg-transparent px-3 py-2 placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
        @keydown.enter="isValidName && onSave()"
      />
    </div>

    <template #footer>
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button
        variant="primary"
        size="lg"
        :loading
        :disabled="!isValidName"
        @click="onSave"
      >
        {{ $t('workspacePanel.editWorkspaceDialog.save') }}
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
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getErrorMessage } from '@/utils/errorUtil'

const { t } = useI18n()
const toast = useToast()
const dialogStore = useDialogStore()
const workspaceStore = useTeamWorkspaceStore()
const loading = ref(false)
const newWorkspaceName = ref(workspaceStore.workspaceName)

const isValidName = computed(() => {
  const name = newWorkspaceName.value.trim()
  const safeNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_'.,()&+]*$/
  return name.length >= 1 && name.length <= 50 && safeNameRegex.test(name)
})

function onCancel() {
  dialogStore.closeDialog({ key: 'edit-workspace' })
}

async function onSave() {
  if (!isValidName.value) return
  loading.value = true
  try {
    await workspaceStore.updateWorkspaceName(newWorkspaceName.value.trim())
    dialogStore.closeDialog({ key: 'edit-workspace' })
    toast.success(t('workspacePanel.toast.workspaceUpdated.title'), {
      description: t('workspacePanel.toast.workspaceUpdated.message'),
      duration: 5000
    })
  } catch (error) {
    console.error('[EditWorkspaceDialog] Failed to update workspace:', error)
    toast.error(t('workspacePanel.toast.failedToUpdateWorkspace'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  } finally {
    loading.value = false
  }
}
</script>
