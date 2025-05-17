<template>
  <div class="p-4 overflow-auto">
    <h2 class="text-lg font-bold mb-2">
      {{ node.display_name }}
    </h2>
    <MarkdownRenderer
      class="text-sm"
      :content="node.help || node.description || ''"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue'

import MarkdownRenderer from '@/components/common/MarkdownRenderer.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()
</script>
