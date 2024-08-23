<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-model:visible="dialogStore.isVisible"
    modal
    closable
    closeOnEscape
    dismissableMask
    :maximizable="maximizable"
    @hide="dialogStore.closeDialog"
    @maximize="maximized = true"
    @unmaximize="maximized = false"
  >
    <template #header>
      <component
        v-if="dialogStore.headerComponent"
        :is="dialogStore.headerComponent"
      />
      <h3 v-else>{{ dialogStore.title || ' ' }}</h3>
    </template>

    <component :is="dialogStore.component" v-bind="contentProps" />
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDialogStore } from '@/stores/dialogStore'
import Dialog from 'primevue/dialog'

const dialogStore = useDialogStore()
const maximizable = dialogStore.props.maximizable ?? false
const maximized = ref(false)
const contentProps = computed(() => ({
  ...dialogStore.props,
  ...(dialogStore.props.maximizable ? { maximized } : {})
}))
</script>
