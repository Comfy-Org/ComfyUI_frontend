<template>
  <AppDialogPanel @close="onDismiss">
    <template #title>
      {{ $t('workspacePanel.inviteLinks.invalidTitle') }}
    </template>

    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('workspacePanel.inviteLinks.invalidBody') }}
    </p>

    <template #footer>
      <Button variant="secondary" size="lg" @click="onDismiss">
        {{ $t('workspacePanel.inviteLinks.invalidDismiss') }}
      </Button>
    </template>
  </AppDialogPanel>
</template>

<script setup lang="ts">
import AppDialogPanel from '@/components/dialog/AppDialogPanel.vue'
import Button from '@/components/ui/button/Button.vue'
import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

function onDismiss() {
  dialogStore.closeDialog({ key: 'invite-link-invalid' })
}
</script>
