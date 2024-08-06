<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-model:visible="dialogStore.isVisible"
    modal
    closable
    closeOnEscape
    dismissableMask
    @hide="dialogStore.closeDialog"
  >
    <template #header>
      <h3>{{ dialogStore.title }}</h3>
    </template>

    <component :is="dialogStore.component" v-bind="dialogStore.props" />
  </Dialog>
</template>

<script setup lang="ts">
import { useDialogStore } from '@/stores/dialogStore'
import Dialog from 'primevue/dialog'

const dialogStore = useDialogStore()
</script>
