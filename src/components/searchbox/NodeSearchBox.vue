<template>
  <div
    class="comfy-vue-node-search-container flex justify-center items-center w-full min-w-96"
  >
    <div
      v-if="enableNodePreview"
      class="comfy-vue-node-preview-container absolute left-[-350px] top-[50px]"
    >
      <NodePreview
        v-if="hoveredSuggestion"
        :key="hoveredSuggestion?.name || ''"
        :node-def="hoveredSuggestion"
      />
    </div>

    <Button
      icon="pi pi-filter"
      severity="secondary"
      class="filter-button z-10"
      @click="nodeSearchFilterVisible = true"
    />
    <Dialog
      v-model:visible="nodeSearchFilterVisible"
      class="min-w-96"
      dismissable-mask
      modal
      @hide="reFocusInput"
    >
      <template #header>
        <h3>Add node filter condition</h3>
      </template>
      <div class="_dialog-body">
        <NodeSearchFilter @add-filter="onAddFilter" />
      </div>
    </Dialog>

    <AutoCompletePlus
      :model-value="filters"
      class="comfy-vue-node-search-box z-10 flex-grow"
      scroll-height="40vh"
      :placeholder="placeholder"
      :input-id="inputId"
      append-to="self"
      :suggestions="suggestions"
      :min-length="0"
      :delay="100"
      :loading="!nodeFrequencyStore.isLoaded"
      complete-on-focus
      auto-option-focus
      force-selection
      multiple
      :option-label="'display_name'"
      @complete="search($event.query)"
      @option-select="emit('addNode', $event.value)"
      @focused-option-changed="setHoverSuggestion($event)"
    >
      <template #option="{ option }">
        <NodeSearchItem :node-def="option" :current-query="currentQuery" />
      </template>
      <!-- FilterAndValue -->
      <template #chip="{ value }">
        <SearchFilterChip
          v-if="value.filterDef && value.value"
          :key="`${value.filterDef.id}-${value.value}`"
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
    </AutoCompletePlus>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import NodePreview from '@/components/node/NodePreview.vue'
import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import {
  ComfyNodeDefImpl,
  useNodeDefStore,
  useNodeFrequencyStore
} from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'

import SearchFilterChip from '../common/SearchFilterChip.vue'

const settingStore = useSettingStore()
const { t } = useI18n()

const enableNodePreview = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.NodePreview')
)

const { filters, searchLimit = 64 } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
  searchLimit?: number
}>()

const nodeSearchFilterVisible = ref(false)
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const placeholder = computed(() => {
  return filters.length === 0 ? t('g.searchNodes') + '...' : ''
})

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()
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
}

const emit = defineEmits(['addFilter', 'removeFilter', 'addNode'])

let inputElement: HTMLInputElement | null = null
const reFocusInput = async () => {
  inputElement ??= document.getElementById(inputId) as HTMLInputElement
  if (inputElement) {
    inputElement.blur()
    await nextTick(() => inputElement?.focus())
  }
}

onMounted(reFocusInput)
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
const setHoverSuggestion = (index: number) => {
  if (index === -1) {
    hoveredSuggestion.value = null
    return
  }
  const value = suggestions.value[index]
  hoveredSuggestion.value = value
}
</script>
