<template>
  <AppDialogPanel body-class="flex flex-col gap-4" @close="onCancel">
    <template #title>
      {{ $t('workspacePanel.createWorkspaceDialog.title') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.createWorkspaceDialog.message') }}
    </p>
    <div class="flex flex-col gap-2 text-sm">
      <label class="text-muted-foreground">
        {{ $t('workspacePanel.createWorkspaceDialog.nameLabel') }}
      </label>
      <input
        v-model="workspaceName"
        type="text"
        class="h-10 w-full rounded-lg border-none bg-secondary px-4 placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
        :placeholder="
          $t('workspacePanel.createWorkspaceDialog.namePlaceholder')
        "
        @keydown.enter="isValidName && onCreate()"
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
        @click="onCreate"
      >
        {{ $t('workspacePanel.createWorkspaceDialog.create') }}
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

const { onConfirm } = defineProps<{
  onConfirm?: (name: string) => void | Promise<void>
}>()

const { t } = useI18n()
const dialogStore = useDialogStore()
const toast = useToast()
const workspaceStore = useTeamWorkspaceStore()
const loading = ref(false)
const workspaceName = ref('')

const isValidName = computed(() => {
  const name = workspaceName.value.trim()
  const safeNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_'.,()&+]*$/
  return name.length >= 1 && name.length <= 50 && safeNameRegex.test(name)
})

function onCancel() {
  dialogStore.closeDialog({ key: 'create-workspace' })
}

async function onCreate() {
  if (!isValidName.value) return
  loading.value = true
  try {
    const name = workspaceName.value.trim()
    // Call optional callback if provided
    await onConfirm?.(name)
    dialogStore.closeDialog({ key: 'create-workspace' })
    // Create workspace and switch to it (triggers reload internally)
    await workspaceStore.createWorkspace(name)
  } catch (error) {
    console.error('[CreateWorkspaceDialog] Failed to create workspace:', error)
    toast.error(t('workspacePanel.toast.failedToCreateWorkspace'), {
      description: getErrorMessage(error) ?? t('g.unknownError')
    })
  } finally {
    loading.value = false
  }
}
</script>
