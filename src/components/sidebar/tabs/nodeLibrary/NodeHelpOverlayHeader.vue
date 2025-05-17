<template>
  <div class="px-2 py-1 flex items-center">
    <Button
      v-tooltip.bottom="$t('g.back')"
      icon="pi pi-arrow-left"
      text
      severity="secondary"
      @click="$emit('close')"
    />
    <span class="ml-2 font-semibold">
      {{ node.display_name }}
    </span>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import { defineEmits, defineProps } from 'vue'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()
defineEmits<{ (e: 'close'): void }>()
</script>
