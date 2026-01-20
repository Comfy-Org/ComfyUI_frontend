<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-for="item in dialogStore.dialogStack"
    :key="item.key"
    v-model:visible="item.visible"
    class="global-dialog"
    v-bind="item.dialogComponentProps"
    :close-on-escape="false"
    :pt="item.dialogComponentProps.pt"
    :aria-labelledby="item.key"
  >
    <template #header>
      <div v-if="!item.dialogComponentProps?.headless">
        <component
          :is="item.headerComponent"
          v-if="item.headerComponent"
          v-bind="item.headerProps"
          :id="item.key"
        />
        <h3 v-else :id="item.key">
          {{ item.title || ' ' }}
        </h3>
      </div>
    </template>

    <component
      :is="item.component"
      v-bind="item.contentProps"
      :maximized="item.dialogComponentProps.maximized"
    />

    <template v-if="item.footerComponent" #footer>
      <component :is="item.footerComponent" v-bind="item.footerProps" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import Dialog from 'primevue/dialog'

import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

/**
 * Custom escape key handler that closes only the active dialog.
 * Uses capture phase to intercept before PrimeVue's built-in handler.
 * This fixes the issue where pressing Escape would close the wrong dialog
 * when multiple dialogs are open (e.g., Settings + Sign In).
 */
function handleEscapeKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (dialogStore.dialogStack.length === 0) return

  const activeDialog = dialogStore.dialogStack.find(
    (d) => d.key === dialogStore.activeKey
  )
  if (!activeDialog || activeDialog.dialogComponentProps.closable === false)
    return

  event.stopImmediatePropagation()
  event.preventDefault()
  dialogStore.closeDialog({ key: activeDialog.key })
}

useEventListener(document, 'keydown', handleEscapeKey, { capture: true })
</script>

<style>
@reference '../../assets/css/style.css';

.global-dialog .p-dialog-header {
  @apply p-2 2xl:p-[var(--p-dialog-header-padding)];
  @apply pb-0;
}

.global-dialog .p-dialog-content {
  @apply p-2 2xl:p-[var(--p-dialog-content-padding)];
  @apply pt-0;
}
</style>
