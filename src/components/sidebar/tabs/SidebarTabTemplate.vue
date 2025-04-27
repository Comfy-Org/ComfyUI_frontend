<template>
  <div
    class="comfy-vue-side-bar-container flex flex-col h-full group/sidebar-tab"
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
          <div
            class="flex flex-row motion-safe:w-0 motion-safe:opacity-0 motion-safe:group-hover/sidebar-tab:w-auto motion-safe:group-hover/sidebar-tab:opacity-100 motion-safe:group-focus-within/sidebar-tab:w-auto motion-safe:group-focus-within/sidebar-tab:opacity-100 touch:w-auto touch:opacity-100 transition-all duration-200"
          >
            <slot name="tool-buttons" />
          </div>
        </template>
      </Toolbar>
      <slot name="header" />
    </div>
    <!-- h-0 to force scrollpanel to flex-grow -->
    <ScrollPanel class="comfy-vue-side-bar-body flex-grow h-0">
      <slot name="body" />
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
