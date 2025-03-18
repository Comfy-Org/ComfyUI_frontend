<template>
  <div class="flex flex-col gap-4 mt-4 overflow-auto text-sm">
    <div v-if="nodeDefs?.length">
      <!-- TODO: when registry returns node defs, use them here -->
    </div>
    <div
      v-else
      v-for="i in 3"
      :key="i"
      class="border border-surface-border rounded-lg p-4"
    >
      <NodePreview :node-def="placeholderNodeDef" />
    </div>
  </div>
</template>

<script setup lang="ts">
import NodePreview from '@/components/node/NodePreview.vue'
import { ComfyNodeDef } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { components } from '@/types/comfyRegistryTypes'

defineProps<{
  nodePack: components['schemas']['Node']
  nodeDefs?: components['schemas']['ComfyNode'][]
}>()

// TODO: when registry returns node defs, use them here
const placeholderNodeDef: ComfyNodeDef = {
  name: 'Sample Node',
  display_name: 'Sample Node',
  description: 'This is a sample node for preview purposes',
  inputs: {
    input1: { name: 'Input 1', type: 'IMAGE' },
    input2: { name: 'Input 2', type: 'CONDITIONING' }
  },
  outputs: [
    { name: 'Output 1', type: 'IMAGE', index: 0, is_list: false },
    { name: 'Output 2', type: 'MASK', index: 1, is_list: false }
  ],
  category: 'Utility',
  output_node: false,
  python_module: 'nodes'
}
</script>
