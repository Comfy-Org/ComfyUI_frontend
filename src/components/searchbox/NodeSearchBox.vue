<template>
  <div
    class="comfy-vue-node-search-container flex w-full min-w-96 items-center justify-center"
  >
    <div
      v-if="enableNodePreview && hoveredSuggestion"
      class="comfy-vue-node-preview-container absolute top-1/2 left-[-375px] z-50 hidden max-h-[85vh] -translate-y-1/2 cursor-pointer overflow-y-auto 2xl:block"
      @mousedown.stop="onAddNode(hoveredSuggestion!, $event)"
    >
      <NodePreview
        :key="hoveredSuggestion?.name || ''"
        :node-def="hoveredSuggestion"
        position="relative"
      />
    </div>

    <Button
      variant="secondary"
      :aria-label="$t('g.addNodeFilterCondition')"
      class="filter-button z-10"
      @click="filterVisible = true"
    >
      <i class="icon-[lucide--funnel]" />
    </Button>
    <Dialog :open="filterVisible" @update:open="onFilterDialogOpenChange">
      <DialogPortal>
        <DialogOverlay
          data-testid="node-search-filter-overlay"
          @pointerdown.self.stop="filterVisible = false"
        />
        <DialogContent
          class="min-w-96"
          @escape-key-down="$event.isComposing && $event.preventDefault()"
          @pointer-down-outside="(e) => onRekaPointerDownOutside({}, e)"
          @close-auto-focus="onFilterDialogCloseAutoFocus"
        >
          <DialogHeader>
            <DialogTitle>{{ $t('g.addNodeFilterCondition') }}</DialogTitle>
            <DialogClose :aria-label="$t('g.close')" />
          </DialogHeader>
          <div class="px-4 py-2">
            <NodeSearchFilter @add-filter="onAddFilter" />
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>

    <SearchAutocomplete
      ref="searchAutocomplete"
      v-model="currentQuery"
      :clear-label="$t('g.clear')"
      :accessible-label="searchLabel"
      class="comfy-vue-node-search-box z-10 grow"
      anchor-class="h-auto min-h-8 flex-wrap"
      :content-style="{ maxHeight: '40vh' }"
      :placeholder="placeholder"
      :input-id="inputId"
      :suggestions="suggestions"
      :loading="!nodeFrequencyStore.isLoaded"
      open-on-focus
      :update-model-on-select="false"
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
import { debounce } from 'es-toolkit/compat'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { onRekaPointerDownOutside } from '@/components/dialog/dialogDismissGuards'
import NodePreview from '@/components/node/NodePreview.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import Button from '@comfyorg/design-system/button/Button'
import Dialog from '@comfyorg/design-system/dialog/Dialog'
import DialogClose from '@comfyorg/design-system/dialog/DialogClose'
import DialogContent from '@comfyorg/design-system/dialog/DialogContent'
import DialogHeader from '@comfyorg/design-system/dialog/DialogHeader'
import DialogOverlay from '@comfyorg/design-system/dialog/DialogOverlay'
import DialogPortal from '@comfyorg/design-system/dialog/DialogPortal'
import DialogTitle from '@comfyorg/design-system/dialog/DialogTitle'
import SearchAutocomplete from '@comfyorg/design-system/search-input/SearchAutocomplete'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { useSearchQueryTracking } from '@/platform/telemetry/searchQuery/useSearchQueryTracking'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useNodeFrequencyStore } from '@/stores/nodeFrequencyStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'

import SearchFilterChip from '@/components/common/SearchFilterChip.vue'

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
const filterVisible = defineModel<boolean>('filterVisible', { required: true })
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const searchLabel = computed(() =>
  t('g.searchPlaceholder', { subject: t('g.nodes') })
)
const placeholder = computed(() =>
  filters.length === 0 ? searchLabel.value : ''
)

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
    ? nodeDefStore.topNodeDefs
    : [
        ...nodeDefStore.nodeSearchService.searchNode(query, filters, {
          limit: searchLimit
        })
      ]

  // Track search queries with debounce
  debouncedTrackSearch(query)
}

const debouncedSearch = debounce(search, 100)
watch(currentQuery, debouncedSearch)
onUnmounted(() => {
  debouncedSearch.cancel()
  debouncedTrackSearch.cancel()
})

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

function onFilterDialogOpenChange(open: boolean) {
  filterVisible.value = open
}

function onFilterDialogCloseAutoFocus(event: Event) {
  event.preventDefault()
  void reFocusInput()
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
  filterVisible.value = false
  emit('addFilter', filterAndValue)
}
const onRemoveFilter = async (
  event: Event,
  filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
) => {
  event.stopPropagation()
  event.preventDefault()
  emit('removeFilter', filterAndValue)
  await nextTick()
  await reFocusInput()
}
const setHoverSuggestion = (suggestion: ComfyNodeDefImpl | undefined) => {
  hoveredSuggestion.value = suggestion ?? null
}
</script>
