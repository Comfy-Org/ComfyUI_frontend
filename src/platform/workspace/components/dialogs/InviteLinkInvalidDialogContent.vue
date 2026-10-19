<template>
  <DialogPanel class="w-full max-w-lg" @close="onDismiss">
    <template #title>
      {{ $t('workspacePanel.inviteLinks.invalidTitle') }}
    </template>

    <div class="p-4">
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.inviteLinks.invalidBody') }}
      </p>
    </div>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onDismiss">
        {{ $t('workspacePanel.inviteLinks.invalidDismiss') }}
      </Button>
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function onDismiss() {
  dialogStore.closeDialog({ key: 'invite-link-invalid' })
}
</script>
