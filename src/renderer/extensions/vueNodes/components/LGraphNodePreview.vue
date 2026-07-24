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
      <NodeSlots
        :node-data="nodeData"
        :inputs="previewInputs"
        :outputs="previewOutputs"
      />

      <WidgetGrid
        v-if="previewWidgets.length"
        :processed-widgets="previewWidgets"
        :node-type="nodeData.type"
        :node-id="nodeData.id"
        class="pointer-events-none"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraphEventMode, RenderShape } from '@/lib/litegraph/src/litegraph'
import NodeHeader from '@/renderer/extensions/vueNodes/components/NodeHeader.vue'
import NodeSlots from '@/renderer/extensions/vueNodes/components/NodeSlots.vue'
import WidgetGrid from '@/renderer/extensions/vueNodes/components/WidgetGrid.vue'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { WidgetValue } from '@/types/simplifiedWidget'
import { zeroUuid } from '@/utils/uuid'
import { cn } from '@comfyorg/tailwind-utils'

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

const previewInputs = computed<INodeInputSlot[]>(() =>
  Object.entries(nodeDef.inputs || {})
    .filter(([, input]) => !widgetStore.inputIsWidget(input))
    .map(([name, input]) => ({
      name,
      type: input.type,
      shape: input.isOptional ? RenderShape.HollowCircle : undefined,
      boundingRect: [0, 0, 0, 0],
      link: null
    }))
)

const previewOutputs = computed<INodeOutputSlot[]>(() =>
  (nodeDef.outputs || []).map((output) => {
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
)

const nodeData = computed<NodeState>(() => ({
  id: toNodeId(`preview-${nodeDef.name}`),
  graphId: zeroUuid,
  title: nodeDef.display_name || nodeDef.name,
  type: nodeDef.name,
  mode: LGraphEventMode.ALWAYS,
  flags: {
    collapsed: false
  }
}))

const previewWidgets = computed<WidgetGridItem[]>(() =>
  Object.entries(nodeDef.inputs || {})
    .filter(
      ([, input]) =>
        widgetStore.inputIsWidget(input) && !input.hidden && !input.advanced
    )
    .map(([name, input]) => {
      const comboValues =
        input.type === 'COMBO' && Array.isArray(input.options)
          ? input.options
          : undefined
      const leadValue = widgetValues?.[name]
      const value = (leadValue ??
        input.default ??
        comboValues?.[0] ??
        '') as WidgetValue
      const type = input.widgetType || input.type
      const values =
        leadValue !== undefined && comboValues
          ? [leadValue, ...comboValues.filter((option) => option !== leadValue)]
          : comboValues
      return {
        visible: true,
        renderKey: `preview:${nodeDef.name}:${name}`,
        vueComponent: getComponent(type) ?? WidgetLegacy,
        simplified: { name, type, value, options: { values }, spec: input }
      }
    })
)
</script>
