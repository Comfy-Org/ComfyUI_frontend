<template>
  <div
    class="comfy-vue-side-bar-container flex flex-col h-full"
    :class="props.class"
  >
    <div class="comfy-vue-side-bar-header">
      <Toolbar
        class="flex-shrink-0 border-x-0 border-t-0 rounded-none px-2 py-1 min-h-10"
      >
        <template #start>
          <span class="text-sm">{{ props.title.toUpperCase() }}</span>
        </template>
        <template #end>
          <slot name="tool-buttons"></slot>
        </template>
      </Toolbar>
      <slot name="header"></slot>
    </div>
    <!-- h-0 to force scrollpanel to flex-grow -->
    <ScrollPanel class="comfy-vue-side-bar-body flex-grow h-0">
      <div class="h-full">
        <slot name="body"></slot>
      </div>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import Toolbar from 'primevue/toolbar'
import ScrollPanel from 'primevue/scrollpanel'

const props = defineProps<{
  title: string
  class?: string
}>()
</script>
