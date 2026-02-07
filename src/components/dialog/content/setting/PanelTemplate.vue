<template>
  <TabPanel :value class="h-full w-full" :class="panelClass">
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

const { value, class: panelClass } = defineProps<{
  value: string
  class?: string
}>()
</script>
