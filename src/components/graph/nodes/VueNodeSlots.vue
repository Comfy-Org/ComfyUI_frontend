<template>
  <div class="vue-node-slots">
    <!-- Input slots -->
    <div v-if="inputs.length > 0" class="inputs mb-2">
      <div 
        v-for="(input, index) in inputs" 
        :key="`input-${index}`"
        class="input-slot flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark-theme:hover:bg-gray-700"
        @click="onSlotClick(index, $event, 'input')"
      >
        <!-- Input connection point -->
        <div 
          class="slot-connector w-3 h-3 rounded-full border-2 border-gray-400 bg-white dark-theme:bg-gray-800"
          :class="getSlotColor(input.type, 'input')"
        ></div>
        
        <!-- Input label -->
        <span class="text-sm text-gray-700 dark-theme:text-gray-300 flex-grow">
          {{ input.name || `Input ${index}` }}
        </span>
        
        <!-- Input type badge -->
        <span 
          v-if="input.type && input.type !== '*'"
          class="text-xs px-1 py-0.5 bg-gray-200 dark-theme:bg-gray-600 text-gray-600 dark-theme:text-gray-400 rounded"
        >
          {{ input.type }}
        </span>
      </div>
    </div>
    
    <!-- Output slots -->
    <div v-if="outputs.length > 0" class="outputs">
      <div 
        v-for="(output, index) in outputs" 
        :key="`output-${index}`"
        class="output-slot flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark-theme:hover:bg-gray-700"
        @click="onSlotClick(index, $event, 'output')"
      >
        <!-- Output type badge -->
        <span 
          v-if="output.type && output.type !== '*'"
          class="text-xs px-1 py-0.5 bg-gray-200 dark-theme:bg-gray-600 text-gray-600 dark-theme:text-gray-400 rounded"
        >
          {{ output.type }}
        </span>
        
        <!-- Output label -->
        <span class="text-sm text-gray-700 dark-theme:text-gray-300 flex-grow text-right">
          {{ output.name || `Output ${index}` }}
        </span>
        
        <!-- Output connection point -->
        <div 
          class="slot-connector w-3 h-3 rounded-full border-2 border-gray-400 bg-white dark-theme:bg-gray-800"
          :class="getSlotColor(output.type, 'output')"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { INodeInputSlot, INodeOutputSlot } from '@comfyorg/litegraph'

interface VueNodeSlotsProps {
  inputs: INodeInputSlot[]
  outputs: INodeOutputSlot[]
}

const props = defineProps<VueNodeSlotsProps>()

const emit = defineEmits<{
  'slot-click': [slotIndex: number, event: MouseEvent]
}>()

// Color mapping for different slot types
const getSlotColor = (type: string | number | undefined, _direction: 'input' | 'output') => {
  if (!type || type === '*') {
    return 'border-gray-400'
  }
  
  // Convert type to string for lookup
  const typeStr = String(type)
  
  // Map common ComfyUI types to colors
  const typeColors: Record<string, string> = {
    'IMAGE': 'border-green-500 bg-green-100 dark-theme:bg-green-900',
    'LATENT': 'border-purple-500 bg-purple-100 dark-theme:bg-purple-900',
    'MODEL': 'border-blue-500 bg-blue-100 dark-theme:bg-blue-900',
    'CONDITIONING': 'border-yellow-500 bg-yellow-100 dark-theme:bg-yellow-900',
    'VAE': 'border-red-500 bg-red-100 dark-theme:bg-red-900',
    'CLIP': 'border-orange-500 bg-orange-100 dark-theme:bg-orange-900',
    'STRING': 'border-gray-500 bg-gray-100 dark-theme:bg-gray-900',
    'INT': 'border-indigo-500 bg-indigo-100 dark-theme:bg-indigo-900',
    'FLOAT': 'border-pink-500 bg-pink-100 dark-theme:bg-pink-900'
  }
  
  return typeColors[typeStr.toUpperCase()] || 'border-gray-400'
}

const onSlotClick = (index: number, event: MouseEvent, slotType: 'input' | 'output') => {
  event.stopPropagation()
  
  // Calculate the actual slot index based on type
  // For outputs, we need to add the input count to get the correct index
  const slotIndex = slotType === 'output' ? props.inputs.length + index : index
  
  emit('slot-click', slotIndex, event)
}
</script>

<style scoped>
.vue-node-slots {
  font-size: 0.875rem;
}

.slot-connector {
  transition: all 0.2s ease;
  cursor: pointer;
}

.slot-connector:hover {
  transform: scale(1.2);
  border-width: 3px;
}

.input-slot {
  border-left: 3px solid transparent;
}

.output-slot {
  border-right: 3px solid transparent;
}

.input-slot:hover {
  border-left-color: #3b82f6;
}

.output-slot:hover {
  border-right-color: #3b82f6;
}
</style>