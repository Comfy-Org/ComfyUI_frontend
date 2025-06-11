<template>
  <div class="vue-node-header flex items-center justify-between p-2 bg-gray-100 dark-theme:bg-gray-700 rounded-t">
    <div class="flex items-center gap-2 flex-grow">
      <!-- Node type badge -->
      <span 
        v-if="nodeType" 
        class="text-xs px-2 py-1 bg-blue-100 dark-theme:bg-blue-900 text-blue-800 dark-theme:text-blue-200 rounded"
      >
        {{ nodeType }}
      </span>
      
      <!-- Editable title -->
      <EditableText
        v-model="editableTitle"
        class="font-medium text-sm flex-grow"
        @update:model-value="onTitleUpdate"
      />
    </div>
    
    <!-- Node controls -->
    <div class="flex items-center gap-1">
      <!-- Collapse/expand button -->
      <button
        v-if="node.constructor?.collapsable !== false"
        class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 dark-theme:text-gray-400 dark-theme:hover:text-gray-200 rounded hover:bg-gray-200 dark-theme:hover:bg-gray-600"
        @click="toggleCollapse"
      >
        <i class="mdi mdi-chevron-up" :class="{ 'rotate-180': node.collapsed }"></i>
      </button>
      
      <!-- Pin button -->
      <button
        class="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-700 dark-theme:text-gray-400 dark-theme:hover:text-gray-200 rounded hover:bg-gray-200 dark-theme:hover:bg-gray-600"
        :class="{ 'text-blue-600 dark-theme:text-blue-400': node.pinned }"
        @click="togglePin"
      >
        <i class="mdi mdi-pin" :class="{ 'mdi-pin-off': !node.pinned }"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
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

// Local editable title
const editableTitle = ref(props.title)

// Watch for external title changes
watch(() => props.title, (newTitle) => {
  editableTitle.value = newTitle
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

const togglePin = () => {
  // Use pin method if available, otherwise set property
  if (props.node.pin) {
    props.node.pin()
  } else {
    // Fallback to manual property setting if method doesn't exist
    ;(props.node as any).pinned = !props.node.pinned
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