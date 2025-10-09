<template>
  <div
    class="comfy-vue-side-bar-container group/sidebar-tab flex h-full flex-col"
    :class="props.class"
  >
    <div class="comfy-vue-side-bar-header">
      <Toolbar class="min-h-8 rounded-none border-x-0 border-t-0 px-2 py-1">
        <template #start>
          <span class="truncate text-xs 2xl:text-sm" :title="props.title">
            {{ props.title.toUpperCase() }}
          </span>
        </template>
        <template #end>
          <div
            class="touch:w-auto touch:opacity-100 flex flex-row transition-all duration-200 motion-safe:w-0 motion-safe:opacity-0 motion-safe:group-focus-within/sidebar-tab:w-auto motion-safe:group-focus-within/sidebar-tab:opacity-100 motion-safe:group-hover/sidebar-tab:w-auto motion-safe:group-hover/sidebar-tab:opacity-100"
          >
            <slot name="tool-buttons" />
          </div>
        </template>
      </Toolbar>
      <slot name="header" />
    </div>
    <!-- h-0 to force scrollpanel to grow -->
    <ScrollPanel class="comfy-vue-side-bar-body h-0 grow">
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
@reference '../../../assets/css/style.css';

:deep(.p-toolbar-end) .p-button {
  @apply py-1 2xl:py-2;
}

:deep(.p-toolbar-start) {
  @apply min-w-0 flex-1 overflow-hidden;
}
</style>
