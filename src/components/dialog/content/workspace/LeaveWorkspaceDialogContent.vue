<template>
  <div
    class="flex w-full max-w-[360px] flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <!-- Header -->
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.leaveDialog.title') }}
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
    <div class="px-4 py-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.leaveDialog.message') }}
      </p>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-4 px-4 py-4">
      <Button variant="muted-textonly" @click="onCancel">
        {{ $t('g.cancel') }}
      </Button>
      <Button variant="destructive" size="lg" :loading @click="onLeave">
        {{ $t('workspacePanel.leaveDialog.leave') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useWorkspace } from '@/platform/workspace/composables/useWorkspace'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()
const { leaveWorkspace } = useWorkspace()
const loading = ref(false)

function onCancel() {
  dialogStore.closeDialog({ key: 'leave-workspace' })
}

async function onLeave() {
  loading.value = true
  try {
    await leaveWorkspace()
    dialogStore.closeDialog({ key: 'leave-workspace' })
  } finally {
    loading.value = false
  }
}
</script>
