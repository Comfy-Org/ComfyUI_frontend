<script setup lang="ts">
import type { SuperNode } from '@/renderer/extensions/superComfy/engine/documentSchema'

import ExecutableNode from './ExecutableNode.vue'
import IoNode from './IoNode.vue'

const { node, selected } = defineProps<{
  node: SuperNode
  selected: boolean
}>()
</script>

<template>
  <IoNode v-if="node.kind === 'io'" :node :selected />
  <ExecutableNode v-else :node :selected />
</template>
