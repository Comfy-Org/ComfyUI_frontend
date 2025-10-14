<template>
  <TabPanel :value="props.value" class="h-full w-full" :class="props.class">
    <div class="flex h-full w-full flex-col gap-2">
      <slot name="header" />
      <ScrollPanel class="h-0 grow pr-2">
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
