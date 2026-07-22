<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { cn } from '@comfyorg/tailwind-utils'

const { nodes, query } = defineProps<{
  nodes: LGraphNode[]
  query: string
}>()

const emit = defineEmits<{
  select: [node: LGraphNode]
}>()

const { t } = useI18n()

const filteredNodes = computed(() => {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  return nodes.filter(
    (node) =>
      node.title.toLowerCase().includes(q) ||
      node.type?.toLowerCase().includes(q)
  )
})

const highlightedIndex = ref(0)
watch(filteredNodes, () => {
  highlightedIndex.value = 0
})

function moveHighlight(delta: number) {
  const count = filteredNodes.value.length
  if (!count) return
  highlightedIndex.value = (highlightedIndex.value + delta + count) % count
}

function confirmHighlighted() {
  const node = filteredNodes.value[highlightedIndex.value]
  if (node) emit('select', node)
}

defineExpose({ moveHighlight, confirmHighlighted })
</script>

<template>
  <div
    class="absolute bottom-full left-0 z-10 mb-1 max-h-56 w-64 overflow-y-auto rounded-lg border border-border-subtle bg-base-background py-1 shadow-interface"
  >
    <button
      v-for="(node, index) in filteredNodes"
      :key="node.id"
      type="button"
      :class="
        cn(
          'flex w-full cursor-pointer items-center gap-2 truncate border-0 bg-transparent px-3 py-1.5 text-left text-sm text-base-foreground',
          index === highlightedIndex && 'bg-secondary-background-hover'
        )
      "
      @mouseenter="highlightedIndex = index"
      @click="emit('select', node)"
    >
      {{ node.title }}
    </button>
    <p
      v-if="!filteredNodes.length"
      class="px-3 py-2 text-sm text-muted-foreground"
    >
      {{ t('agent.mentionPicker.empty') }}
    </p>
  </div>
</template>
