<template>
  <div
    class="flex w-full max-w-[400px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.editWorkspaceDialog.title') }}
      </h2>
      <button
        class="cursor-pointer rounded border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-secondary-foreground"
        :aria-label="$t('g.close')"
        @click="onCancel"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <!-- Body -->
    <div class="flex flex-col gap-4 px-4 py-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm text-base-foreground">
          {{ $t('workspacePanel.editWorkspaceDialog.nameLabel') }}
        </label>
        <input
          v-model="newWorkspaceName"
          type="text"
          class="w-full rounded-lg border border-border-default bg-transparent px-3 py-2 text-sm text-base-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-secondary-foreground"
          @keydown.enter="isValidName && onSave()"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 px-4 py-4">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { workspaceName, updateWorkspaceName } = useWorkspace()
const loading = ref(false)
const newWorkspaceName = ref(workspaceName.value)

const isValidName = computed(() => {
  const name = newWorkspaceName.value.trim()
  const safeNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9\s\-_]*$/
  return name.length >= 1 && name.length <= 50 && safeNameRegex.test(name)
})

function onCancel() {
  dialogStore.closeDialog({ key: 'edit-workspace' })
}

async function onSave() {
  if (!isValidName.value) return
  loading.value = true
  try {
    updateWorkspaceName(newWorkspaceName.value.trim())
    dialogStore.closeDialog({ key: 'edit-workspace' })
  } finally {
    loading.value = false
  }
}
</script>
