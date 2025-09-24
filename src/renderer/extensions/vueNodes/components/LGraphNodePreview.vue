<template>
  <div class="scale-75">
    <NodeBaseTemplate
      :node-data="nodeData"
      :readonly="true"
      :container-classes="containerClasses"
      :is-collapsed="false"
      :separator-classes="separatorClasses"
      :has-custom-content="false"
      :image-urls="[]"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
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

// Static classes for preview mode
const containerClasses =
  'bg-white dark-theme:bg-charcoal-800 lg-node absolute rounded-2xl border border-solid border-sand-100 dark-theme:border-charcoal-600 outline-transparent -outline-offset-2 outline-2 pointer-events-none'
const separatorClasses =
  'bg-sand-100 dark-theme:bg-charcoal-600 h-px mx-0 w-full'
</script>
