<template>
  <div
    class="flex w-full max-w-lg flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.inviteLinks.invalidTitle') }}
      </h2>
      <button
        class="focus-visible:ring-secondary-foreground cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground focus-visible:ring-1 focus-visible:outline-none"
        :aria-label="$t('g.close')"
        @click="onDismiss"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.inviteLinks.invalidBody') }}
      </p>
    </div>

    <div class="flex items-center justify-end p-4">
      <Button variant="secondary" size="lg" @click="onDismiss">
        {{ $t('workspacePanel.inviteLinks.invalidDismiss') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function onDismiss() {
  dialogStore.closeDialog({ key: 'invite-link-invalid' })
}
</script>
