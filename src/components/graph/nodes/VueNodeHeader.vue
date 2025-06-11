<template>
  <div 
    class="vue-node-header flex items-center justify-between px-3 py-2"
    :style="headerStyle"
  >
    <div class="flex items-center gap-2 flex-grow">
      <!-- Collapse dot (like original LiteGraph) -->
      <div 
        class="w-2.5 h-2.5 rounded-full cursor-pointer"
        :style="{ backgroundColor: dotColor }"
        @click="toggleCollapse"
      />
      
      <!-- Editable title -->
      <EditableText
        v-model="editableTitle"
        class="font-medium flex-grow"
        :style="titleStyle"
        @update:model-value="onTitleUpdate"
      />
    </div>
    
    <!-- Node controls (minimized to match LiteGraph style) -->
    <div class="flex items-center gap-1">
      <!-- Pin indicator (small, unobtrusive) -->
      <div
        v-if="node.pinned"
        class="w-2 h-2 rounded-full"
        :style="{ backgroundColor: litegraphColors.NODE_TITLE_COLOR }"
        title="Pinned"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import EditableText from '@/components/common/EditableText.vue'

interface VueNodeHeaderProps {
  node: LGraphNode
  title: string
  nodeType?: string
}

const props = defineProps<VueNodeHeaderProps>()

const emit = defineEmits<{
  'title-edit': [title: string]
}>()

const colorPaletteStore = useColorPaletteStore()
const litegraphColors = computed(
  () => colorPaletteStore.completedActivePalette.colors.litegraph_base
)

// Local editable title
const editableTitle = ref(props.title)

// Watch for external title changes
watch(() => props.title, (newTitle) => {
  editableTitle.value = newTitle
})

// Header styling to match LiteGraph
const headerStyle = computed(() => {
  try {
    const headerColor = props.node.color || litegraphColors.value?.NODE_DEFAULT_COLOR || '#333'
    return {
      backgroundColor: headerColor,
      borderTopLeftRadius: '4px',
      borderTopRightRadius: '4px',
      fontSize: `${litegraphColors.value?.NODE_TEXT_SIZE || 14}px`,
    }
  } catch (error) {
    console.warn('⚠️ VueNodeHeader: Error in headerStyle:', error)
    return {
      backgroundColor: '#333',
      borderTopLeftRadius: '4px',
      borderTopRightRadius: '4px',
      fontSize: '14px',
    }
  }
})

// Title styling to match LiteGraph
const titleStyle = computed(() => {
  try {
    const selected = (props.node as any).selected || false
    const titleColor = selected 
      ? litegraphColors.value?.NODE_SELECTED_TITLE_COLOR || '#FFF'
      : litegraphColors.value?.NODE_TITLE_COLOR || '#999'
      
    return {
      color: titleColor,
      fontSize: `${litegraphColors.value?.NODE_TEXT_SIZE || 14}px`,
      fontWeight: 'normal',
    }
  } catch (error) {
    console.warn('⚠️ VueNodeHeader: Error in titleStyle:', error)
    return {
      color: '#999',
      fontSize: '14px',
      fontWeight: 'normal',
    }
  }
})

// Dot color (collapse indicator)
const dotColor = computed(() => {
  try {
    return litegraphColors.value?.NODE_TITLE_COLOR || '#999'
  } catch (error) {
    console.warn('⚠️ VueNodeHeader: Error in dotColor:', error)
    return '#999'
  }
})

const onTitleUpdate = (newTitle: string) => {
  emit('title-edit', newTitle)
}

const toggleCollapse = () => {
  // Use node collapse method instead of setting property directly
  if (props.node.collapse) {
    props.node.collapse()
  } else {
    // Fallback to manual property setting if method doesn't exist
    ;(props.node as any).collapsed = !props.node.collapsed
  }
  // Trigger canvas redraw
  props.node.setDirtyCanvas?.(true, true)
}
</script>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
}
</style>