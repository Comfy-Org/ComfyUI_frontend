<template>
  <div
    :data-node-id="nodeData.id"
    :class="
      cn(
        'lg-node flex w-[350px] touch-none flex-col rounded-2xl border border-solid border-node-stroke bg-component-node-background pb-1 outline-2 outline-transparent contain-layout contain-style',
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
        v-if="previewWidgetIds.length"
        :node-data="nodeData"
        :widget-ids="previewWidgetIds"
        class="pointer-events-none"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watchEffect } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { RenderShape } from '@/lib/litegraph/src/litegraph'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeSlots from '@/renderer/extensions/vueNodes/components/NodeSlots.vue'
import NodeWidgets from '@/renderer/extensions/vueNodes/components/NodeWidgets.vue'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import type { WidgetId } from '@/types/widgetId'
import { widgetId } from '@/types/widgetId'
import { cn } from '@comfyorg/tailwind-utils'

let previewInstanceCounter = 0

function nextPreviewGraphId() {
  previewInstanceCounter += 1
  return `preview-${previewInstanceCounter}`
}
const {
  nodeDef,
  position = 'absolute',
  widgetValues
} = defineProps<{
  nodeDef: ComfyNodeDefV2
  position?: 'absolute' | 'relative'
  widgetValues?: Record<string, string>
}>()

const widgetStore = useWidgetStore()
const widgetValueStore = useWidgetValueStore()
const previewGraphId = nextPreviewGraphId()

const nodeData = computed<VueNodeData>(() => {
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
    id: toNodeId(`preview-${nodeDef.name}`),
    title: nodeDef.display_name || nodeDef.name,
    type: nodeDef.name,
    mode: 0,
    selected: false,
    executing: false,
    inputs,
    outputs,
    flags: {
      collapsed: false
    }
  }
})

const previewWidgets = computed(() =>
  Object.entries(nodeDef.inputs || {})
    .filter(([_, input]) => widgetStore.inputIsWidget(input))
    .map(([name, input]) => {
      const comboValues =
        input.type === 'COMBO' && Array.isArray(input.options)
          ? input.options
          : undefined
      const leadValue = widgetValues?.[name]
      const value =
        leadValue ??
        (input.default !== undefined ? input.default : (comboValues?.[0] ?? ''))
      const options = {
        hidden: input.hidden,
        advanced: input.advanced,
        values:
          leadValue && comboValues
            ? [leadValue, ...comboValues.filter((o) => o !== leadValue)]
            : comboValues
      } satisfies IWidgetOptions
      return {
        id: widgetId(previewGraphId, nodeData.value.id, name),
        input,
        type: input.widgetType || input.type,
        value,
        options
      }
    })
)

const previewWidgetIds = computed<WidgetId[]>(() =>
  previewWidgets.value.map((widget) => widget.id)
)

watchEffect(() => {
  for (const { id, input, type, value, options } of previewWidgets.value) {
    const state = widgetValueStore.registerWidget(id, { type, value, options })
    state.value = value
    state.options = options
    widgetValueStore.registerWidgetRenderState(id, { advanced: input.advanced })
    widgetValueStore.registerWidgetSpec(id, input)
  }
})

onUnmounted(() => {
  for (const id of previewWidgetIds.value) {
    widgetValueStore.deleteWidget(id)
  }
})
</script>
