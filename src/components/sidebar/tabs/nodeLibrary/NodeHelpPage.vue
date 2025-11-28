<template>
  <div class="flex h-full flex-col overflow-auto bg-(--p-tree-background)">
    <div
      class="flex items-center border-b border-(--p-divider-color) px-3 py-2"
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
    <div class="grow p-4">
      <NodeHelpContent :node="node" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'

import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()

defineEmits<{
  (e: 'close'): void
}>()
</script>
