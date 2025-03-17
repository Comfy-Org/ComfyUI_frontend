<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-for="(item, index) in dialogStore.dialogStack"
    :key="item.key"
    v-model:visible="item.visible"
    class="global-dialog"
    v-bind="item.dialogComponentProps"
    :auto-z-index="false"
    :pt="item.dialogComponentProps.pt"
    :pt:mask:style="{ zIndex: baseZIndex + index + 1 }"
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

    <template #footer v-if="item.footerComponent">
      <component :is="item.footerComponent" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ZIndex } from '@primeuix/utils/zindex'
import { usePrimeVue } from '@primevue/core'
import Dialog from 'primevue/dialog'
import { computed, onMounted } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

const primevue = usePrimeVue()

const baseZIndex = computed(() => {
  return primevue?.config?.zIndex?.modal ?? 1100
})

onMounted(() => {
  const mask = document.createElement('div')
  ZIndex.set('model', mask, baseZIndex.value)
})
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
