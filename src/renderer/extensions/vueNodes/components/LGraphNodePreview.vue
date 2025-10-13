<template>
  <div class="scale-75">
    <div
      class="lg-node pointer-events-none absolute rounded-2xl border border-solid border-node-component-border bg-node-component-surface outline-2 -outline-offset-2 outline-transparent"
    >
      <NodeHeader :node-data="nodeData" :readonly="readonly" />

      <div class="mx-0 mb-4 h-px w-full bg-node-component-border" />

      <div class="flex flex-col gap-4 pb-4">
        <NodeSlots
          v-memo="[nodeData.inputs?.length, nodeData.outputs?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <NodeWidgets
          v-if="nodeData.widgets?.length"
          v-memo="[nodeData.widgets?.length]"
          :node-data="nodeData"
          :readonly="readonly"
        />

        <NodeContent
          v-if="hasCustomContent"
          :node-data="nodeData"
          :readonly="readonly"
          :image-urls="nodeImageUrls"
        />
      </div>
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
import NodeContent from '@/renderer/extensions/vueNodes/components/NodeContent.vue'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeSlots from '@/renderer/extensions/vueNodes/components/NodeSlots.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefV2
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
            : undefined,
      options: {
        ...input,
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

const readonly = true
const hasCustomContent = false
const nodeImageUrls = ['']
</script>
