<template>
  <div
    class="comfy-vue-node-search-container flex w-full min-w-96 items-center justify-center"
  >
    <div
      v-if="enableNodePreview && hoveredSuggestion"
      class="comfy-vue-node-preview-container absolute top-[50px] left-[-375px] z-50 cursor-pointer"
      @mousedown.stop="onAddNode(hoveredSuggestion!, $event)"
    >
      <NodePreview
        :key="hoveredSuggestion?.name || ''"
        :node-def="hoveredSuggestion"
      />
    </div>

    <Button
      variant="secondary"
      :aria-label="$t('g.addNodeFilterCondition')"
      class="filter-button z-10"
      @click="nodeSearchFilterVisible = true"
    >
      <i class="pi pi-filter" />
    </Button>
    <Dialog
      v-model:visible="nodeSearchFilterVisible"
      class="min-w-96"
      dismissable-mask
      modal
      @hide="reFocusInput"
    >
      <template #header>
        <h3>{{ $t('g.addNodeFilterCondition') }}</h3>
      </template>
      <div class="_dialog-body">
        <NodeSearchFilter @add-filter="onAddFilter" />
      </div>
    </Dialog>

    <SearchAutocomplete
      ref="searchAutocomplete"
      v-model="currentQuery"
      class="comfy-vue-node-search-box z-10 grow"
      anchor-class="h-auto min-h-8 flex-wrap"
      :content-style="{ maxHeight: '40vh' }"
      :placeholder="placeholder"
      :input-id="inputId"
      :suggestions="suggestions"
      :loading="!nodeFrequencyStore.isLoaded"
      open-on-focus
      option-label="display_name"
      option-key="name"
      @select="onAddNode"
      @highlight="setHoverSuggestion"
    >
      <template #suggestion="{ suggestion }">
        <NodeSearchItem :node-def="suggestion" :current-query="currentQuery" />
      </template>
      <template #leading>
        <div v-if="filters.length" class="ml-8 flex flex-wrap gap-1 py-1">
          <template
            v-for="filter in filters"
            :key="`${filter.filterDef?.id}-${filter.value}`"
          >
            <SearchFilterChip
              v-if="filter.filterDef && filter.value"
              data-testid="node-search-filter-chip"
              :text="filter.value"
              :badge="filter.filterDef.invokeSequence.toUpperCase()"
              :badge-class="filter.filterDef.invokeSequence + '-badge'"
              @remove="onRemoveFilter($event, filter)"
            />
          </template>
        </div>
      </template>
    </SearchAutocomplete>
  </div>
</template>

<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { debounce } from 'es-toolkit/compat'
import Dialog from 'primevue/dialog'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NodePreview from '@/components/node/NodePreview.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import Button from '@/components/ui/button/Button.vue'
import SearchAutocomplete from '@/components/ui/search-input/SearchAutocomplete.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { useSearchQueryTracking } from '@/platform/telemetry/searchQuery/useSearchQueryTracking'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'

import SearchFilterChip from '../common/SearchFilterChip.vue'

const settingStore = useSettingStore()
const { t } = useI18n()
const telemetry = useTelemetry()

const enableNodePreview = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.NodePreview')
)

const { filters, searchLimit = 64 } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
  searchLimit?: number
}>()

const searchAutocomplete = ref<{
  focus: () => void
  open: () => void
} | null>(null)
const nodeSearchFilterVisible = ref(false)
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const placeholder = computed(() => {
  return filters.length === 0
    ? t('g.searchPlaceholder', { subject: t('g.nodes') })
    : ''
})

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()

useSearchQueryTracking('node_modal', currentQuery, suggestions)

// Debounced search tracking (500ms as per implementation plan)
const debouncedTrackSearch = debounce((query: string) => {
  if (query.trim()) {
    telemetry?.trackNodeSearch({ query })
  }
}, 500)

const search = (query: string) => {
  const queryIsEmpty = query === '' && filters.length === 0
  currentQuery.value = query
  suggestions.value = queryIsEmpty
    ? nodeFrequencyStore.topNodeDefs
    : [
        ...nodeDefStore.nodeSearchService.searchNode(query, filters, {
          limit: searchLimit
        })
      ]

  // Track search queries with debounce
  debouncedTrackSearch(query)
}

watchDebounced(currentQuery, search, { debounce: 100 })

const emit = defineEmits<{
  addFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  removeFilter: [filter: FuseFilterWithValue<ComfyNodeDefImpl, string>]
  addNode: [nodeDef: ComfyNodeDefImpl, dragEvent?: MouseEvent]
}>()

// Track node selection and emit addNode event
function onAddNode(nodeDef: ComfyNodeDefImpl, event?: MouseEvent) {
  telemetry?.trackNodeSearchResultSelected({
    node_type: nodeDef.name,
    last_query: currentQuery.value
  })
  emit('addNode', nodeDef, event)
}

const reFocusInput = async () => {
  search(currentQuery.value)
  await nextTick()
  searchAutocomplete.value?.focus()
  searchAutocomplete.value?.open()
}

onMounted(() => {
  search('')
  void nextTick(() => {
    searchAutocomplete.value?.focus()
    searchAutocomplete.value?.open()
  })
})
const onAddFilter = (
  filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => {
  nodeSearchFilterVisible.value = false
  emit('addFilter', filterAndValue)
}
const onRemoveFilter = async (
  event: Event,
  filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => {
  event.stopPropagation()
  event.preventDefault()
  emit('removeFilter', filterAndValue)
  await reFocusInput()
}
const setHoverSuggestion = (suggestion: ComfyNodeDefImpl | undefined) => {
  hoveredSuggestion.value = suggestion ?? null
}
</script>
