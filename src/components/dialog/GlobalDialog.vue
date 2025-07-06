<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-for="item in dialogStore.dialogStack"
    :key="item.key"
    v-model:visible="item.visible"
    class="global-dialog"
    v-bind="item.dialogComponentProps"
    :pt="item.dialogComponentProps.pt"
    :aria-labelledby="item.key"
  >
    <template #header>
      <component
        :is="item.headerComponent"
        v-if="item.headerComponent"
        :id="item.key"
      />
      <h3 v-else :id="item.key">
        {{ item.title || ' ' }}
      </h3>
    </template>

    <component
      :is="item.component"
      v-bind="item.contentProps"
      :maximized="item.dialogComponentProps.maximized"
    />

    <template v-if="item.footerComponent" #footer>
      <component :is="item.footerComponent" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'

import { useDialogStore } from '@/stores/dialogStore'

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

.manager-dialog {
  height: 80vh;
  max-width: 1724px;
  max-height: 1026px;
}

@media (min-width: 3000px) {
  .manager-dialog {
    max-width: 2200px;
    max-height: 1320px;
  }
}
</style>
