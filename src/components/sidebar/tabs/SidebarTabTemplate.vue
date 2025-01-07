<template>
  <div
    class="comfy-vue-side-bar-container flex flex-col h-full"
    :class="props.class"
  >
    <div class="comfy-vue-side-bar-header">
      <Toolbar class="border-x-0 border-t-0 rounded-none px-2 py-1 min-h-8">
        <template #start>
          <span class="text-xs 2xl:text-sm truncate" :title="props.title">
            {{ props.title.toUpperCase() }}
          </span>
        </template>
        <template #end>
          <slot name="tool-buttons"></slot>
        </template>
      </Toolbar>
      <slot name="header"></slot>
    </div>
    <!-- h-0 to force scrollpanel to flex-grow -->
    <ScrollPanel class="comfy-vue-side-bar-body flex-grow h-0">
      <slot name="body"></slot>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import Toolbar from 'primevue/toolbar'

const props = defineProps<{
  title: string
  class?: string
}>()
</script>

<style scoped>
:deep(.p-toolbar-end) .p-button {
  @apply py-1 2xl:py-2;
}

:deep(.p-toolbar-start) {
  @apply min-w-0 flex-1 overflow-hidden;
}
</style>
