<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div class="flex h-12 items-center border-b border-border-default px-4">
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.createWorkspaceDialog.title') }}
      </h2>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-6 p-4">
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{ $t('workspacePanel.createWorkspaceDialog.message') }}
      </p>
      <div class="flex flex-col gap-2">
        <label class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.createWorkspaceDialog.nameLabel') }}
        </label>
        <input
          v-model="workspaceName"
          type="text"
          class="focus:ring-secondary-foreground h-10 w-full rounded-lg border-none bg-secondary-background px-4 text-sm text-base-foreground placeholder:text-muted-foreground focus:ring-1 focus:outline-none"
          :placeholder="
            $t('workspacePanel.createWorkspaceDialog.namePlaceholder')
          "
          @keydown.enter="isValidName && onNext()"
        />
      </div>
      <div
        class="flex items-center gap-2 rounded-lg border border-border-subtle bg-secondary-background p-4"
      >
        <i class="icon-[lucide--info] size-4 shrink-0 text-base-foreground" />
        <p class="m-0 text-sm/5 text-base-foreground">
          {{ $t('workspacePanel.createWorkspaceDialog.personalStaysInfo') }}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 p-4">
      <Button
        variant="secondary"
        size="lg"
        :loading
        :disabled="!isValidName"
        @click="onNext"
      >
        {{ $t('workspacePanel.createWorkspaceDialog.next') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

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

async function onNext() {
  if (!isValidName.value) return
  loading.value = true
  try {
    const name = workspaceName.value.trim()
    await onConfirm?.(name)
    dialogStore.closeDialog({ key: 'create-team-workspace' })
    await workspaceStore.createWorkspace(name)
  } catch (error) {
    console.error(
      '[CreateTeamWorkspaceDialog] Failed to create workspace:',
      error
    )
    toast.add({
      severity: 'error',
      summary: t('workspacePanel.toast.failedToCreateWorkspace'),
      detail: error instanceof Error ? error.message : t('g.unknownError')
    })
  } finally {
    loading.value = false
  }
}
</script>
