<template>
  <div class="node-info-section">
    <div
      class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-foreground-muted"
    >
      {{ $t('rightSidePanel.info') }}
    </div>
    <div class="space-y-2 rounded-lg bg-interface-surface p-3 text-sm">
      <div class="flex flex-col gap-1">
        <span class="font-medium text-base-foreground">{{
          $t('rightSidePanel.nodeType')
        }}</span>
        <span class="text-base-foreground-muted">{{ node.type }}</span>
      </div>
      <div v-if="node.id !== undefined" class="flex flex-col gap-1">
        <span class="font-medium text-base-foreground">{{
          $t('rightSidePanel.nodeId')
        }}</span>
        <span class="text-base-foreground-muted">{{ node.id }}</span>
      </div>
      <div v-if="nodeDescription" class="flex flex-col gap-1">
        <span class="font-medium text-base-foreground">{{
          $t('rightSidePanel.description')
        }}</span>
        <p class="text-base-foreground-muted">{{ nodeDescription }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const props = defineProps<{
  nodes: LGraphNode[]
}>()
const node = computed(() => props.nodes[0])

const nodeDefStore = useNodeDefStore()

const nodeInfo = computed(() => {
  return nodeDefStore.fromLGraphNode(node.value)
})

const nodeDescription = computed(() => {
  // @ts-expect-error - desc property may exist on constructor
  return node.value.constructor?.desc || nodeInfo.value?.description || null
})
</script>
