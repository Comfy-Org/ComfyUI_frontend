<template>
  <div class="comfy-vue-node-search-container">
    <div class="comfy-vue-node-preview-container">
      <NodePreview
        :nodeDef="hoveredSuggestion"
        :key="hoveredSuggestion?.name || ''"
        v-if="hoveredSuggestion"
      />
    </div>
    <NodeSearchFilter @addFilter="onAddFilter" />
    <AutoCompletePlus
      :model-value="props.filters"
      class="comfy-vue-node-search-box"
      scrollHeight="40vh"
      :placeholder="placeholder"
      :input-id="inputId"
      append-to="self"
      :suggestions="suggestions"
      :min-length="0"
      @complete="search($event.query)"
      @option-select="emit('addNode', $event.value)"
      @focused-option-changed="setHoverSuggestion($event)"
      complete-on-focus
      auto-option-focus
      force-selection
      multiple
    >
      <template v-slot:option="{ option }">
        <div class="option-container">
          <div class="option-display-name">
            {{ option.display_name }}
            <NodeSourceChip
              v-if="option.python_module !== undefined"
              :python_module="option.python_module"
            />
          </div>
          <div class="option-category">
            {{ option.category.replaceAll('/', ' > ') }}
          </div>
        </div>
      </template>
      <!-- FilterAndValue -->
      <template v-slot:chip="{ value }">
        <Chip removable @remove="onRemoveFilter($event, value)">
          <Badge size="small" :class="value[0].invokeSequence + '-badge'">
            {{ value[0].invokeSequence.toUpperCase() }}
          </Badge>
          {{ value[1] }}
        </Chip>
      </template>
    </AutoCompletePlus>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import Chip from 'primevue/chip'
import Badge from 'primevue/badge'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSourceChip from '@/components/node/NodeSourceChip.vue'
import { type FilterAndValue } from '@/services/nodeSearchService'
import NodePreview from '@/components/node/NodePreview.vue'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'

const props = defineProps({
  filters: {
    type: Array<FilterAndValue>
  },
  searchLimit: {
    type: Number,
    default: 64
  }
})

const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const placeholder = computed(() => {
  return props.filters.length === 0 ? 'Search for nodes' : ''
})

const search = (query: string) => {
  suggestions.value = useNodeDefStore().nodeSearchService.searchNode(
    query,
    props.filters,
    {
      limit: props.searchLimit
    }
  )
}

const emit = defineEmits(['addFilter', 'removeFilter', 'addNode'])

const reFocusInput = () => {
  const inputElement = document.getElementById(inputId) as HTMLInputElement
  if (inputElement) {
    inputElement.blur()
    inputElement.focus()
  }
}

onMounted(reFocusInput)
const onAddFilter = (filterAndValue: FilterAndValue) => {
  emit('addFilter', filterAndValue)
  reFocusInput()
}
const onRemoveFilter = (event: Event, filterAndValue: FilterAndValue) => {
  event.stopPropagation()
  event.preventDefault()
  emit('removeFilter', filterAndValue)
  reFocusInput()
}
const setHoverSuggestion = (index: number) => {
  if (index === -1) {
    hoveredSuggestion.value = null
    return
  }
  const value = suggestions.value[index]
  hoveredSuggestion.value = value
}
</script>

<style scoped>
.comfy-vue-node-search-container {
  @apply flex justify-center items-center w-full min-w-96;
}

.comfy-vue-node-search-container * {
  pointer-events: auto;
}

.comfy-vue-node-preview-container {
  position: absolute;
  left: -350px;
  top: 50px;
}

.comfy-vue-node-search-box {
  @apply z-10 flex-grow;
}

.option-container {
  @apply flex flex-col px-4 py-2 cursor-pointer overflow-hidden w-full;
}

.option-display-name {
  @apply font-semibold;
}

.option-category {
  @apply text-sm text-gray-400 overflow-hidden text-ellipsis;
  /* Keeps the text on a single line by default */
  white-space: nowrap;
}

.i-badge {
  @apply bg-green-500 text-white;
}

.o-badge {
  @apply bg-red-500 text-white;
}

.c-badge {
  @apply bg-blue-500 text-white;
}

.s-badge {
  @apply bg-yellow-500;
}
</style>
