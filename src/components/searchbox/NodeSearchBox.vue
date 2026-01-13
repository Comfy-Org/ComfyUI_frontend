<template>
  <div
    class="comfy-vue-node-search-container flex w-full min-w-96 items-center justify-center"
  >
    <div
      v-if="enableNodePreview && hoveredSuggestion"
      class="comfy-vue-node-preview-container absolute top-[50px] left-[-375px] z-50 cursor-pointer"
      @mousedown.stop="onAddNode(hoveredSuggestion!)"
    >
      <NodePreview
        :key="hoveredSuggestion?.name || ''"
        :node-def="hoveredSuggestion"
      />
    </div>

    <Dialog
      v-model:visible="nodeSearchFilterVisible"
      class="min-w-96"
      dismissable-mask
      modal
      @hide="nextTick(() => inputRef?.focus())"
    >
      <template #header>
        <h3>{{ $t('g.addNodeFilterCondition') }}</h3>
      </template>
      <div class="_dialog-body">
        <NodeSearchFilter @add-filter="onAddFilter" />
      </div>
    </Dialog>

    <div class="comfy-vue-node-search-box z-10 grow">
      <div
        class="flex w-full items-center bg-base-background rounded-lg py-1 px-4 border-primary-background border"
      >
        <Button
          variant="secondary"
          :aria-label="$t('g.addNodeFilterCondition')"
          class="filter-button z-10 absolute -left-10"
          @click="nodeSearchFilterVisible = true"
        >
          <i class="pi pi-filter" />
        </Button>
        <template
          v-for="value in filters"
          :key="`${value.filterDef.id}-${value.value}`"
        >
          <SearchFilterChip
            v-if="value.filterDef && value.value"
            :text="value.value"
            :badge="value.filterDef.invokeSequence.toUpperCase()"
            :badge-class="value.filterDef.invokeSequence + '-badge'"
            @remove="
              onRemoveFilter(
                $event,
                value as FuseFilterWithValue<ComfyNodeDefImpl, string>
              )
            "
          />
        </template>
        <input
          ref="inputRef"
          v-model="currentQuery"
          class="text-base h-5 bg-transparent border-0 focus:outline-0 flex-1"
          type="text"
          autofocus
          :placeholder="t('g.searchNodes') + '...'"
          @keydown.enter.prevent="onAddNode(hoveredSuggestion)"
          @keydown.down.prevent="updateIndexBy(1)"
          @keydown.up.prevent="updateIndexBy(-1)"
        />
      </div>
      <div
        v-bind="containerProps"
        class="bg-comfy-menu-bg p-1 rounded-lg border-border-subtle border max-h-150"
      >
        <div v-bind="wrapperProps" class="comfy-autocomplete-list">
          <NodeSearchItem
            v-for="{ data: option, index } in virtualList"
            :key="index"
            :class="
              cn(
                'p-1 rounded-sm',
                hoveredIndex === index && 'bg-secondary-background-hover'
              )
            "
            :node-def="option"
            :current-query="debouncedQuery"
            @click="onAddNode(option)"
            @pointerover="hoveredIndex = index"
          />
        </div>
        <div
          v-if="suggestions.length === 0"
          class="p-1"
          v-text="t('g.noResultsFound')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { refDebounced, useVirtualList } from '@vueuse/core'
import Dialog from 'primevue/dialog'
import { computed, nextTick, ref, useTemplateRef, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import NodePreview from '@/components/node/NodePreview.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import Button from '@/components/ui/button/Button.vue'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore, useNodeFrequencyStore } from '@/stores/nodeDefStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { cn } from '@/utils/tailwindUtil'

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

const nodeSearchFilterVisible = ref(false)
const currentQuery = ref('')
const debouncedQuery = refDebounced(currentQuery, 100, { maxWait: 400 })
const inputRef = useTemplateRef('inputRef')

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()

watchEffect(() => {
  const query = debouncedQuery.value
  if (query.trim()) {
    telemetry?.trackNodeSearch({ query })
  }
})

const suggestions = computed(() => {
  const query = debouncedQuery.value
  const queryIsEmpty = query === '' && filters.length === 0

  return queryIsEmpty
    ? nodeFrequencyStore.topNodeDefs
    : [
        ...nodeDefStore.nodeSearchService.searchNode(query, filters, {
          limit: searchLimit
        })
      ]
})

const {
  list: virtualList,
  containerProps,
  wrapperProps
} = useVirtualList(suggestions, { itemHeight: 40 })

const emit = defineEmits(['addFilter', 'removeFilter', 'addNode'])

// Track node selection and emit addNode event
const onAddNode = (nodeDef?: ComfyNodeDefImpl) => {
  if (!nodeDef) return
  telemetry?.trackNodeSearchResultSelected({
    node_type: nodeDef.name,
    last_query: debouncedQuery.value
  })
  emit('addNode', nodeDef)
}

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
  inputRef.value?.focus()
}
const hoveredIndex = ref<number>()
const hoveredSuggestion = computed(() =>
  hoveredIndex.value ? suggestions.value[hoveredIndex.value] : undefined
)
function updateIndexBy(delta: number) {
  hoveredIndex.value = Math.max(
    0,
    Math.min(suggestions.value.length, (hoveredIndex.value ?? 0) + delta)
  )
}
</script>
