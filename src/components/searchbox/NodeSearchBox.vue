<template>
  <div class="comfy-vue-node-search-container">
    <div class="comfy-vue-node-preview-container" v-if="enableNodePreview">
      <NodePreview
        :nodeDef="hoveredSuggestion"
        :key="hoveredSuggestion?.name || ''"
        v-if="hoveredSuggestion"
      />
    </div>

    <Button
      icon="pi pi-filter"
      severity="secondary"
      class="_filter-button"
      @click="nodeSearchFilterVisible = true"
    />
    <Dialog v-model:visible="nodeSearchFilterVisible" class="_dialog">
      <template #header>
        <h3>Add node filter condition</h3>
      </template>
      <div class="_dialog-body">
        <NodeSearchFilter @addFilter="onAddFilter"></NodeSearchFilter>
      </div>
    </Dialog>

    <AutoCompletePlus
      :model-value="props.filters"
      class="comfy-vue-node-search-box"
      scrollHeight="40vh"
      :placeholder="placeholder"
      :input-id="inputId"
      append-to="self"
      :suggestions="suggestions"
      :min-length="0"
      :delay="100"
      :loading="!nodeFrequencyStore.isLoaded"
      @complete="search($event.query)"
      @option-select="emit('addNode', $event.value)"
      @focused-option-changed="setHoverSuggestion($event)"
      complete-on-focus
      auto-option-focus
      force-selection
      multiple
      :optionLabel="'display_name'"
    >
      <template v-slot:option="{ option }">
        <NodeSearchItem :nodeDef="option" :currentQuery="currentQuery" />
      </template>
      <!-- FilterAndValue -->
      <template v-slot:chip="{ value }">
        <SearchFilterChip
          @remove="onRemoveFilter($event, value)"
          :text="value[1]"
          :badge="value[0].invokeSequence.toUpperCase()"
          :badge-class="value[0].invokeSequence + '-badge'"
        />
      </template>
    </AutoCompletePlus>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import { type FilterAndValue } from '@/services/nodeSearchService'
import NodePreview from '@/components/node/NodePreview.vue'
import {
  ComfyNodeDefImpl,
  useNodeDefStore,
  useNodeFrequencyStore
} from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useI18n } from 'vue-i18n'
import SearchFilterChip from '../common/SearchFilterChip.vue'

const settingStore = useSettingStore()
const { t } = useI18n()

const enableNodePreview = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.NodePreview')
)

const props = withDefaults(
  defineProps<{
    filters: FilterAndValue[]
    searchLimit?: number
  }>(),
  {
    searchLimit: 64
  }
)

const nodeSearchFilterVisible = ref(false)
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const placeholder = computed(() => {
  return props.filters.length === 0 ? t('searchNodes') + '...' : ''
})

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()
const search = (query: string) => {
  currentQuery.value = query
  suggestions.value =
    query === ''
      ? nodeFrequencyStore.topNodeDefs
      : [
          ...nodeDefStore.nodeSearchService.searchNode(query, props.filters, {
            limit: props.searchLimit
          })
        ]
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
  nodeSearchFilterVisible.value = false
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

._filter-button {
  z-index: 10;
}

._dialog {
  @apply min-w-96;
}
</style>
