<template>
  <div
    ref="nodeRef"
    class="_sb_node_preview vue-node"
    :style="nodeStyle"
    @mousedown="onMouseDown"
    @contextmenu="onContextMenu"
  >
    <div class="_sb_table">
      <!-- Node header - exactly like NodePreview -->
      <div
        class="node_header"
        :style="{
          backgroundColor: litegraphColors.NODE_DEFAULT_COLOR as string,
          color: litegraphColors.NODE_TITLE_COLOR as string
        }"
      >
        <div class="_sb_dot headdot" />
        {{ (node as any).title }}
      </div>

      <!-- Node slot I/O - using flexbox for proper positioning -->
      <div
        v-for="[slotInput, slotOutput] in slotPairs"
        :key="((slotInput as any)?.name || '') + ((slotOutput as any)?.name || '')"
        class="slot-row-flex"
      >
        <!-- Left side input slot -->
        <div class="slot-left" v-if="slotInput">
          <div :class="['_sb_dot', (slotInput as any)?.type]" />
          <span class="slot-text">{{ (slotInput as any)?.name }}</span>
        </div>
        
        <!-- Right side output slot -->
        <div 
          class="slot-right" 
          v-if="slotOutput"
          :style="{
            color: litegraphColors.NODE_TEXT_COLOR as string
          }"
        >
          <span class="slot-text">{{ (slotOutput as any)?.name }}</span>
          <div :class="['_sb_dot', (slotOutput as any)?.type]" />
        </div>
      </div>

      <!-- Widgets using existing widget components -->
      <VueNodeBody
        :widgets="nodeWidgets"
        :node="node"
        @widget-change="onWidgetChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import _ from 'lodash'
import { computed, ref } from 'vue'
import { useCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import type { LGraphNode } from '@comfyorg/litegraph'
import type { NodeInteractionEvent } from '@/composables/nodeRendering/useNodeInteractionProxy'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useCanvasStore } from '@/stores/graphStore'
import VueNodeBody from './VueNodeBody.vue'

interface VueNodeProps {
  node: LGraphNode
  selected: boolean
  executing: boolean
  canvasScale: number
  canvasOffset: { x: number, y: number }
  updateTrigger?: number // Add update trigger to force reactivity
}

const props = defineProps<VueNodeProps>()

const emit = defineEmits<{
  interaction: [event: NodeInteractionEvent]
}>()

const nodeRef = ref<HTMLElement>()
const colorPaletteStore = useColorPaletteStore()
const canvasStore = useCanvasStore()

const litegraphColors = computed(
  () => colorPaletteStore.completedActivePalette.colors.litegraph_base
)

// Get canvas position conversion utilities
const canvasPositionConversion = computed(() => {
  const lgCanvas = canvasStore.canvas
  if (!lgCanvas?.canvas) return null
  
  return useCanvasPositionConversion(lgCanvas.canvas, lgCanvas)
})

// Slot pairs - filter out inputs that have corresponding widgets
const slotPairs = computed(() => {
  const allInputs = (props.node as any).inputs || []
  const outputs = (props.node as any).outputs || []
  
  // Get widget names to filter out inputs that have widgets
  const nodeWidgetNames = new Set((props.node as any).widgets?.map((w: any) => w.name) || [])
  
  // Only show inputs that DON'T have corresponding widgets
  const slotInputs = allInputs.filter((input: any) => !nodeWidgetNames.has(input.name))
  
  return _.zip(slotInputs, outputs)
})

// Extract widgets from the node
const nodeWidgets = computed(() => {
  return (props.node as any).widgets || []
})

// Dragging will be handled by LiteGraph's phantom node

// Node styling based on position and state - using proper canvas position conversion
const nodeStyle = computed(() => {
  try {
    // Access update trigger to make this reactive to graph changes
    props.updateTrigger
    
    const positionConverter = canvasPositionConversion.value
    if (!positionConverter) {
      console.warn('🚨 VueNode: No position converter available')
      return {
        position: 'fixed' as const,
        left: '100px',
        top: '100px', 
        width: '200px',
        minHeight: '100px',
        backgroundColor: '#ff0000',
        border: '2px solid #ffffff',
        zIndex: 999
      }
    }

    // Get node position and size in graph space
    const nodeAny = props.node as any
    const nodePos: [number, number] = [
      nodeAny.pos?.[0] ?? 0,
      nodeAny.pos?.[1] ?? 0
    ]
    const nodeWidth = nodeAny.size?.[0] ?? 200
    const nodeHeight = nodeAny.size?.[1] ?? 100

    // Convert from canvas coordinates to client coordinates (absolute positioning)
    const [clientX, clientY] = positionConverter.canvasPosToClientPos(nodePos)
    
    // Get the current scale from the canvas
    const lgCanvas = canvasStore.canvas
    const scale = lgCanvas?.ds?.scale ?? 1
    
    // Use original dimensions for positioning, apply scale via CSS transform
    const scaledWidth = nodeWidth
    const scaledHeight = nodeHeight

    // Validate coordinates
    if (!isFinite(clientX) || !isFinite(clientY) || scaledWidth <= 0 || scaledHeight <= 0) {
      return {
        position: 'fixed' as const,
        left: '100px',
        top: '100px', 
        width: '200px',
        minHeight: '100px',
        backgroundColor: '#ff0000',
        border: '2px solid #ffffff',
        zIndex: 999
      }
    }

    // Use colors from palette for authentic LiteGraph appearance
    const nodeAnyForColors = props.node as any
    const bgColor = nodeAnyForColors.bgcolor || litegraphColors.value?.NODE_DEFAULT_BGCOLOR || '#353535'
    const borderColor = props.selected 
      ? litegraphColors.value?.NODE_BOX_OUTLINE_COLOR || '#FFF'
      : (nodeAnyForColors.boxcolor || litegraphColors.value?.NODE_DEFAULT_BOXCOLOR || '#666')
      
    return {
      position: 'fixed' as const, // Use fixed positioning like other overlays
      left: `${clientX}px`,
      top: `${clientY}px`,
      minWidth: `${scaledWidth}px`,
      width: 'auto', // Allow width to expand for content
      minHeight: `${scaledHeight}px`,
      transform: `scale(${scale})`,
      transformOrigin: '0 0', // Scale from top-left corner
      zIndex: props.selected ? 10 : 1,
      backgroundColor: bgColor,
      borderColor: borderColor,
      borderWidth: props.selected ? '2px' : '1px',
      borderStyle: 'solid',
      fontSize: `${litegraphColors.value?.NODE_TEXT_SIZE || 14}px`,
    }
  } catch (error) {
    return {
      position: 'fixed' as const,
      left: '100px',
      top: '100px', 
      width: '200px',
      minHeight: '100px',
      backgroundColor: '#ff0000',
      border: '2px solid #ffffff',
      zIndex: 999
    }
  }
})

// Note: nodeClasses could be used for conditional CSS classes if needed

// Event handlers
const onMouseDown = (event: MouseEvent) => {
  // Check if the click is on a widget element
  const target = event.target as HTMLElement
  const isOnWidget = target.closest('.widget-content') !== null
  
  // If clicking on a widget, don't emit the mouse down event for dragging
  if (isOnWidget) {
    return
  }
  
  emit('interaction', {
    type: 'mousedown',
    nodeId: String((props.node as any).id),
    originalEvent: event
  })
}

const onContextMenu = (event: MouseEvent) => {
  emit('interaction', {
    type: 'contextmenu', 
    nodeId: String((props.node as any).id),
    originalEvent: event
  })
}

// Note: onSlotInteraction and onTitleEdit available for future use

const onWidgetChange = (widgetIndex: number, value: any) => {
  const nodeAny = props.node as any
  if (nodeAny.widgets?.[widgetIndex]) {
    nodeAny.widgets[widgetIndex].value = value
  }
}
</script>

<style scoped>
/* Copy ALL styles from NodePreview.vue exactly */
.slot_row {
  padding: 2px;
}

/* Original N-Sidebar styles */
._sb_dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: grey;
}

.node_header {
  line-height: 1;
  padding: 8px 13px 7px;
  margin-bottom: 5px;
  font-size: 15px;
  text-wrap: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.headdot {
  width: 10px;
  height: 10px;
  float: inline-start;
  margin-right: 8px;
}

.IMAGE {
  background-color: #64b5f6;
}

.VAE {
  background-color: #ff6e6e;
}

.LATENT {
  background-color: #ff9cf9;
}

.MASK {
  background-color: #81c784;
}

.CONDITIONING {
  background-color: #ffa931;
}

.CLIP {
  background-color: #ffd500;
}

.MODEL {
  background-color: #b39ddb;
}

.CONTROL_NET {
  background-color: #a5d6a7;
}

._sb_node_preview {
  background-color: var(--comfy-menu-bg);
  font-family: 'Open Sans', sans-serif;
  font-size: small;
  color: var(--descrip-text);
  border: 1px solid var(--descrip-text);
  min-width: 200px;
  width: max-content; /* Allow expansion for wide content */
  height: fit-content;
  z-index: 9999;
  border-radius: 12px;
  overflow: visible; /* Allow content to be visible outside bounds */
  font-size: 12px;
  padding-bottom: 10px;
}

._sb_node_preview ._sb_description {
  margin: 10px;
  padding: 6px;
  background: var(--border-color);
  border-radius: 5px;
  font-style: italic;
  font-weight: 500;
  font-size: 0.9rem;
  word-break: break-word;
}

._sb_table {
  display: grid;
  grid-column-gap: 10px;
  /* Spazio tra le colonne */
  width: 100%;
  /* Imposta la larghezza della tabella al 100% del contenitore */
}

._sb_row {
  display: grid;
  grid-template-columns: 10px 1fr 1fr 1fr 10px;
  grid-column-gap: 10px;
  align-items: center;
  padding-left: 9px;
  padding-right: 9px;
}

._sb_row_string {
  grid-template-columns: 10px 1fr 1fr 10fr 1fr;
}

._sb_col {
  border: 0 solid #000;
  display: flex;
  align-items: flex-end;
  flex-direction: row-reverse;
  flex-wrap: nowrap;
  align-content: flex-start;
  justify-content: flex-end;
}

._sb_inherit {
  display: inherit;
}

._long_field {
  background: var(--bg-color);
  border: 2px solid var(--border-color);
  margin: 5px 5px 0 5px;
  border-radius: 10px;
  line-height: 1.7;
  text-wrap: nowrap;
}

._sb_arrow {
  color: var(--fg-color);
}

._sb_preview_badge {
  text-align: center;
  background: var(--comfy-input-bg);
  font-weight: bold;
  color: var(--error-text);
}

/* Additional styles for Vue node functionality */
.vue-node {
  position: fixed; /* Use fixed positioning for proper overlay behavior */
  pointer-events: none; /* Let mouse events pass through to phantom nodes */
}

.vue-node .widget-content {
  pointer-events: auto; /* Enable interaction with widgets only */
}

.vue-node:hover {
  z-index: 10000; /* Bring to front on hover */
}

.slot-text {
  font-size: 10px; /* Smaller font for slot labels */
}

/* New flexbox slot layout */
.slot-row-flex {
  position: relative;
  min-height: 20px;
  padding: 2px 0;
}

.slot-left {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.slot-right {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}
</style>