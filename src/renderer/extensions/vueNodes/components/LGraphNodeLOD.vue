<script setup lang="ts">
import { computed } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeLayout } from '@/renderer/extensions/vueNodes/layout/useNodeLayout'

const { nodeData } = defineProps<{ nodeData: VueNodeData }>()

const { position, size } = useNodeLayout(() => nodeData.id)

const style = computed(() => ({
  transform: `translate(${position.value.x ?? 0}px, ${(position.value.y ?? 0) - LiteGraph.NODE_TITLE_HEIGHT}px)`,
  width: `${size.value.width ?? 0}px`,
  height: `${(size.value.height ?? 0) + LiteGraph.NODE_TITLE_HEIGHT}px`,
  backgroundColor: nodeData.bgcolor || undefined
}))
</script>

<template>
  <!--
    Stand-in for a full node while zoomed too far out to read its text, matching
    litegraph's own low-quality pass, which draws a plain filled rect and skips
    text, badges and shadows. Deliberately childless and non-interactive: the
    whole point is that one node costs one element instead of a component tree.
  -->
  <div
    :data-node-id="nodeData.id"
    data-node-lod
    class="lg-node-lod pointer-events-none absolute bg-node-component-surface"
    :style="style"
  />
</template>
