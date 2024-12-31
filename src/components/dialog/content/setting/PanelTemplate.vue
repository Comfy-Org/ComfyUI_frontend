<template>
  <TabPanel :value="props.value" class="h-full w-full" :class="props.class">
    <div class="flex flex-col h-full w-full gap-2">
      <slot name="header" />
      <ScrollPanel class="flex-grow h-0 pr-2">
        <slot />
      </ScrollPanel>
      <slot name="footer" />
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import ScrollPanel from 'primevue/scrollpanel'
import TabPanel from 'primevue/tabpanel'

const props = defineProps<{
  value: string
  class?: string
}>()
</script>
