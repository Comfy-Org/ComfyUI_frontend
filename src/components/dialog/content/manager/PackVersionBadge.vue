<template>
  <Button
    v-if="version"
    :label="version"
    severity="secondary"
    icon="pi pi-chevron-right"
    icon-pos="right"
    class="rounded-xl text-xs tracking-tighter"
    :pt="{
      root: { class: 'p-0' },
      label: { class: 'pl-2 pr-0 py-0.5' },
      icon: { class: 'text-xs pl-0 pr-2 py-0.5' }
    }"
  />
</template>

<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{
  version: string | undefined
}>()
</script>
