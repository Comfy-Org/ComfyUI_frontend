<template>
  <div class="scale-75">
    <NodeBaseTemplate
      :node-data="nodeData"
      :readonly="true"
      :container-classes="presentation.containerBaseClasses.value"
      :is-collapsed="false"
      :separator-classes="presentation.separatorClasses"
      :has-custom-content="false"
      :image-urls="[]"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePresentation } from '@/renderer/extensions/vueNodes/composables/useNodePresentation'
import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useWidgetStore } from '@/stores/widgetStore'

import NodeBaseTemplate from './NodeBaseTemplate.vue'

const { nodeDef } = defineProps<{
  nodeDef: ComfyNodeDefV2
}>()

const widgetStore = useWidgetStore()

// Convert nodeDef into VueNodeData
const nodeData = computed<VueNodeData>(() => {
  // Convert inputs to widgets (those that have widget constructors)
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

  // Filter non-widget inputs for slots
  const inputs = Object.entries(nodeDef.inputs || {})
    .filter(([_, input]) => !widgetStore.inputIsWidget(input))
    .map(([name, input]) => ({
      name,
      type: input.type,
      shape: input.isOptional ? 'HollowCircle' : undefined
    }))

  return {
    id: `preview-${nodeDef.name}`,
    title: nodeDef.display_name || nodeDef.name,
    type: nodeDef.name,
    mode: 0, // Normal mode
    selected: false,
    executing: false,
    widgets,
    inputs,
    outputs: nodeDef.outputs || [],
    flags: {
      collapsed: false
    }
  }
})

// Use the presentation composable with preview mode
const presentation = useNodePresentation(() => nodeData.value, {
  readonly: true,
  isPreview: true
})
</script>
