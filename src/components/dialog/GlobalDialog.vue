<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-for="(item, index) in dialogStore.dialogStack"
    :key="item.key"
    v-model:visible="item.visible"
    class="global-dialog"
    v-bind="item.dialogComponentProps"
    :auto-z-index="false"
    :pt:mask:style="{ zIndex: 2100 + index + 1 }"
    :aria-labelledby="item.key"
  >
    <template #header>
      <component
        v-if="item.headerComponent"
        :is="item.headerComponent"
        :id="item.key"
      />
      <h3 v-else :id="item.key">{{ item.title || ' ' }}</h3>
    </template>

    <component
      :is="item.component"
      v-bind="item.contentProps"
      :maximized="item.dialogComponentProps.maximized"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { useDialogStore } from '@/stores/dialogStore'
import Dialog from 'primevue/dialog'

const dialogStore = useDialogStore()
</script>

<style>
.global-dialog .p-dialog-header {
  @apply p-2 2xl:p-[var(--p-dialog-header-padding)];
  @apply pb-0;
}

.global-dialog .p-dialog-content {
  @apply p-2 2xl:p-[var(--p-dialog-content-padding)];
  @apply pt-0;
}
</style>
