<template>
  <div
    class="flex h-full flex-col bg-white dark-theme:bg-zinc-900"
    :class="props.class"
  >
    <div>
      <div
        v-if="slots.top"
        class="flex min-h-12 items-center border-b border-zinc-200 px-4 py-2 dark-theme:border-zinc-700"
      >
        <slot name="top" />
      </div>
      <div v-if="slots.header" class="px-4">
        <slot name="header" />
      </div>
    </div>
    <!-- h-0 to force scrollpanel to grow -->
    <ScrollPanel class="h-0 grow">
      <slot name="body" />
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import { useSlots } from 'vue'

const props = defineProps<{
  class?: string
}>()

const slots = useSlots()
</script>
