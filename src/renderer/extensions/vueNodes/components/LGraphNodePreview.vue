<template>
  <div
    :data-node-id="nodeData.id"
    :class="
      cn(
        'lg-node flex w-[350px] touch-none flex-col rounded-2xl border-1 border-solid border-node-stroke bg-component-node-background pb-1 outline-2 outline-transparent contain-layout contain-style',
        position
      )
    "
  >
    <div
      class="pointer-events-none relative flex flex-col items-center justify-center"
    >
      <NodeHeader :node-data="nodeData" />
    </div>
    <div
      class="pointer-events-none flex flex-1 flex-col gap-1 pb-2"
      :data-testid="`node-body-${nodeData.id}`"
    >
      <NodeSlots :node-data="nodeData" />

      <NodeWidgets
        v-if="nodeData.widgets?.length"
        :node-data="nodeData"
        class="pointer-events-none"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { RenderShape } from '@/lib/litegraph/src/litegraph'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeSlots from '@/renderer/extensions/vueNodes/components/NodeSlots.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'
import { cn } from '@/utils/tailwindUtil'

const { nodeDef, position = 'absolute' } = defineProps<{
  nodeDef: ComfyNodeDefV2
  position?: 'absolute' | 'relative'
}>()

const widgetStore = useWidgetStore()

// Convert nodeDef into VueNodeData
const nodeData = computed<VueNodeData>(() => {
  const widgets = Object.entries(nodeDef.inputs || {})
    .filter(([_, input]) => widgetStore.inputIsWidget(input))
    .map(([name, input]) => ({
      name,
      type: input.widgetType || input.type,
      value:
        input.default !== undefined
          ? input.default
          : input.type === 'COMBO' &&
              Array.isArray(input.options) &&
              input.options.length > 0
            ? input.options[0]
            : '',
      options: {
        hidden: input.hidden,
        advanced: input.advanced,
        values: input.type === 'COMBO' ? input.options : undefined // For combo widgets
      }
    }))

  const inputs: INodeInputSlot[] = Object.entries(nodeDef.inputs || {})
    .filter(([_, input]) => !widgetStore.inputIsWidget(input))
    .map(([name, input]) => ({
      name,
      type: input.type,
      shape: input.isOptional ? RenderShape.HollowCircle : undefined,
      boundingRect: [0, 0, 0, 0],
      link: null
    }))

  const outputs: INodeOutputSlot[] = (nodeDef.outputs || []).map((output) => {
    if (typeof output === 'string') {
      return {
        name: output,
        type: output,
        boundingRect: [0, 0, 0, 0],
        links: []
      }
    }
    return {
      ...output,
      boundingRect: [0, 0, 0, 0],
      links: []
    }
  })

  return {
    id: `preview-${nodeDef.name}`,
    title: nodeDef.display_name || nodeDef.name,
    type: nodeDef.name,
    mode: 0, // Normal mode
    selected: false,
    executing: false,
    widgets,
    inputs,
    outputs,

    flags: {
      collapsed: false
    }
  }
})
</script>
