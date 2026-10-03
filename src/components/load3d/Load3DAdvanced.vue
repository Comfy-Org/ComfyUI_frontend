<template>
  <Load3D
    :widget="widget"
    :node-id="nodeId"
    :can-use-recording="false"
    :can-use-hdri="false"
    :can-use-background-image="false"
  />
</template>

<script setup lang="ts">
import Load3D from '@/components/load3d/Load3D.vue'
import type { ComponentWidget } from '@/scripts/domWidget'
import type { NodeId } from '@/types/nodeId'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

defineProps<{
  widget: ComponentWidget<string[]> | SimplifiedWidget
  nodeId?: NodeId
}>()
</script>
