<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-model:visible="dialogStore.isVisible"
    modal
    closable
    closeOnEscape
    dismissableMask
    :maximizable="dialogStore.props.maximizable ?? false"
    @hide="dialogStore.closeDialog"
    @maximize="maximized = true"
    @unmaximize="maximized = false"
  >
    <template #header v-if="dialogStore.title">
      <h3>{{ dialogStore.title }}</h3>
    </template>

    <component
      :is="dialogStore.component"
      v-bind="dialogStore.props"
      :maximized="maximized"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'
import Dialog from 'primevue/dialog'

const dialogStore = useDialogStore()

const maximized = ref(false)
</script>
