<!-- The main global dialog to show various things -->
<template>
  <Dialog
    v-for="item in dialogStore.dialogStack"
    :key="item.key"
    :ref="(el) => setDialogRef(item.key, el)"
    v-model:visible="item.visible"
    class="global-dialog"
    v-bind="item.dialogComponentProps"
    :pt="{
      ...item.dialogComponentProps.pt,
      transition: {
        enterFromClass: 'opacity-0 scale-75',
        enterActiveClass: 'transition-all duration-200 ease-out',
        leaveActiveClass: 'transition-all duration-200 ease-in',
        leaveToClass: 'opacity-0 scale-75'
      }
    }"
    :aria-labelledby="item.key"
  >
    <template #header>
      <div v-if="!item.dialogComponentProps?.headless">
        <component
          :is="item.headerComponent"
          v-if="item.headerComponent"
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
import Dialog from 'primevue/dialog'
import { onMounted, ref } from 'vue'

import { useDialogStore } from '@/stores/dialogStore'

const dialogStore = useDialogStore()

// Store refs to Dialog components so we can call their close() method
const dialogRefs = ref<Record<string, any>>({})

function setDialogRef(dialogKey: string, el: any) {
  if (el) {
    dialogRefs.value[dialogKey] = el
  } else {
    delete dialogRefs.value[dialogKey]
  }
}

// Expose method for dialogStore to trigger proper close
function triggerDialogClose(dialogKey: string) {
  const dialogRef = dialogRefs.value[dialogKey]
  if (!dialogRef || typeof dialogRef.close !== 'function') return

  dialogRef.close()
}

// Register with dialogStore so it can call Dialog.close() directly
onMounted(() => {
  dialogStore.registerGlobalDialogCloseFn(triggerDialogClose)
})

// Make the function available to the dialog store
defineExpose({
  triggerDialogClose
})
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
