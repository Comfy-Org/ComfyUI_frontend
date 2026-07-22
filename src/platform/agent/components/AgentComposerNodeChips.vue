<script setup lang="ts">
import Tag from '@/components/chip/Tag.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const emit = defineEmits<{
  remove: [node: LGraphNode]
}>()
</script>

<template>
  <div v-if="nodes.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
    <Tag
      v-for="node in nodes"
      :key="node.id"
      :label="node.title"
      shape="rounded"
      removable
      @remove="emit('remove', node)"
    />
  </div>
</template>
