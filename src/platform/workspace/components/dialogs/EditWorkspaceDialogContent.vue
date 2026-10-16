<template>
  <DialogPanel class="w-full min-w-[400px]" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.editWorkspaceDialog.title') }}
    </template>

    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm text-base-foreground">
          {{ $t('workspacePanel.editWorkspaceDialog.nameLabel') }}
        </label>
        <input
          v-model="newWorkspaceName"
          type="text"
          class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-border-default focus:outline-none"
          @keydown.enter="isValidName && onSave()"
        />
      </div>
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
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
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
