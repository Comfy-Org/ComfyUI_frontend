<template>
  <div class="p-3">
    <GroupSettings v-if="selectedGroup" :group="selectedGroup" />
    <NodeSettings v-else :nodes="nodes.filter((node) => isLGraphNode(node))" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Raw } from 'vue';

import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import type { Positionable } from '@/lib/litegraph/src/interfaces'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'

import GroupSettings from './GroupSettings.vue'
import NodeSettings from './NodeSettings.vue'

const props = defineProps<{
  nodes: Raw<Positionable>[]
}>()

const selectedGroup = computed((): LGraphGroup | null => {
  if (props.nodes.length === 1) {
    const item = props.nodes[0] as Positionable
    if (isLGraphGroup(item)) {
      return item as unknown as LGraphGroup
    }
  }
  return null
})
</script>
