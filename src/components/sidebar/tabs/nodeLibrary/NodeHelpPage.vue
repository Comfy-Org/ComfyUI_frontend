<template>
  <div class="flex flex-col h-full bg-[var(--p-tree-background)]">
    <div
      class="px-3 py-2 flex items-center border-b border-[var(--p-divider-color)]"
    >
      <Button
        v-tooltip.bottom="$t('g.back')"
        icon="pi pi-arrow-left"
        text
        severity="secondary"
        @click="$emit('close')"
      />
      <span class="ml-2 font-semibold">{{ node.display_name }}</span>
    </div>
    <div class="px-4 overflow-auto flex-grow">
      <MarkdownRenderer
        class="text-sm"
        :content="node.help || node.description || ''"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

defineProps<{
  node: ComfyNodeDefImpl
}>()

defineEmits<{
  (e: 'close'): void
}>()
</script>
