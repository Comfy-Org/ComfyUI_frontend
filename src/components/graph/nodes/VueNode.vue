<template>
  <div
    class="vue-node pointer-events-auto flex flex-col bg-white dark-theme:bg-gray-800 border border-gray-300 dark-theme:border-gray-600 rounded shadow-lg"
    :class="nodeClasses"
    :style="nodeStyle"
    @mousedown="onMouseDown"
    @contextmenu="onContextMenu"
  >
    <VueNodeHeader 
      :node="node" 
      :title="node.title"
      :nodeType="node.type"
      @title-edit="onTitleEdit"
    />
    
    <VueNodeSlots
      v-if="!node.collapsed"
      :inputs="node.inputs || []"
      :outputs="node.outputs || []"
      @slot-click="onSlotInteraction"
    />
    
    <!-- Flexbox container for widgets - no manual height calculations needed -->
    <VueNodeBody
      v-if="!node.collapsed"
      class="flex flex-col gap-2 p-2 flex-grow"
      :widgets="nodeWidgets"
      :node="node"
      @widget-change="onWidgetChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import type { NodeInteractionEvent } from '@/composables/nodeRendering/useNodeInteractionProxy'
import type { NodePosition } from '@/composables/nodeRendering/useNodePositionSync'
import VueNodeHeader from './VueNodeHeader.vue'
import VueNodeSlots from './VueNodeSlots.vue'
import VueNodeBody from './VueNodeBody.vue'

interface VueNodeProps {
  node: LGraphNode
  position?: NodePosition
  selected: boolean
  executing: boolean
}

const props = defineProps<VueNodeProps>()

const emit = defineEmits<{
  interaction: [event: NodeInteractionEvent]
}>()

// Node styling based on position and state
const nodeStyle = computed(() => ({
  position: 'absolute' as const,
  left: props.position ? `${props.position.x}px` : '0px',
  top: props.position ? `${props.position.y}px` : '0px',
  minWidth: props.position ? `${props.position.width}px` : '150px',
  // Height is now determined by flexbox content, not manual calculations
  zIndex: props.selected ? 10 : 1,
}))

// Node CSS classes based on state
const nodeClasses = computed(() => ({
  'vue-node--selected': props.selected,
  'vue-node--executing': props.executing,
  'vue-node--collapsed': props.node.collapsed,
  [`vue-node--${props.node.type?.replace(/[^a-zA-Z0-9]/g, '-')}`]: props.node.type
}))

// Extract widgets from the node
const nodeWidgets = computed(() => {
  return props.node.widgets || []
})

// Event handlers
const onMouseDown = (event: MouseEvent) => {
  emit('interaction', {
    type: 'mousedown',
    nodeId: String(props.node.id),
    originalEvent: event
  })
}

const onContextMenu = (event: MouseEvent) => {
  emit('interaction', {
    type: 'contextmenu', 
    nodeId: String(props.node.id),
    originalEvent: event
  })
}

const onSlotInteraction = (slotIndex: number, event: MouseEvent) => {
  emit('interaction', {
    type: 'slot-click',
    nodeId: String(props.node.id),
    originalEvent: event,
    slotIndex
  })
}

const onTitleEdit = (newTitle: string) => {
  props.node.title = newTitle
}

const onWidgetChange = (widgetIndex: number, value: any) => {
  if (props.node.widgets?.[widgetIndex]) {
    props.node.widgets[widgetIndex].value = value
  }
}
</script>

<style scoped>
.vue-node {
  transition: box-shadow 0.2s ease;
}

.vue-node--selected {
  @apply ring-2 ring-blue-500 shadow-xl;
}

.vue-node--executing {
  @apply ring-2 ring-green-500;
  animation: pulse 2s infinite;
}

.vue-node--collapsed {
  @apply h-8;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
}
</style>