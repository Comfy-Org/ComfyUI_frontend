<template>
  <div
    class="comfy-vue-node-search-container flex justify-center items-center w-full min-w-96"
  >
    <div
      v-if="enableNodePreview && !isCommandMode"
      class="comfy-vue-node-preview-container absolute left-[-350px] top-[50px]"
    >
      <NodePreview
        v-if="hoveredSuggestion"
        :key="hoveredSuggestion?.name || ''"
        :node-def="hoveredSuggestion"
      />
    </div>

    <Button
      v-if="!isCommandMode"
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
        <h3>{{ $t('g.addNodeFilterCondition') }}</h3>
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
      :option-label="getOptionLabel"
      @complete="search($event.query)"
      @option-select="onOptionSelect($event.value)"
      @focused-option-changed="setHoverSuggestion($event)"
      @input="handleInput"
    >
      <template #option="{ option }">
        <CommandSearchItem
          v-if="isCommandMode"
          :command="option"
          :current-query="currentQuery"
        />
        <NodeSearchItem
          v-else
          :node-def="option"
          :current-query="currentQuery"
        />
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import NodePreview from '@/components/node/NodePreview.vue'
import AutoCompletePlus from '@/components/primevueOverride/AutoCompletePlus.vue'
import CommandSearchItem from '@/components/searchbox/CommandSearchItem.vue'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSearchItem from '@/components/searchbox/NodeSearchItem.vue'
import { CommandSearchService } from '@/services/commandSearchService'
import { type ComfyCommandImpl, useCommandStore } from '@/stores/commandStore'
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
const commandStore = useCommandStore()

const enableNodePreview = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.NodePreview')
)

const { filters, searchLimit = 64 } = defineProps<{
  filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[]
  searchLimit?: number
}>()

const nodeSearchFilterVisible = ref(false)
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[] | ComfyCommandImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const isCommandMode = ref(false)

// Initialize command search service
const commandSearchService = ref<CommandSearchService | null>(null)

const placeholder = computed(() => {
  if (isCommandMode.value) {
    return t('g.searchCommands', 'Search commands') + '...'
  }
  return filters.length === 0 ? t('g.searchNodes') + '...' : ''
})

const nodeDefStore = useNodeDefStore()
const nodeFrequencyStore = useNodeFrequencyStore()

// Initialize command search service with commands
watch(
  () => commandStore.commands,
  (commands) => {
    commandSearchService.value = new CommandSearchService(commands)
  },
  { immediate: true }
)

const search = (query: string) => {
  currentQuery.value = query

  // Check if we're in command mode (query starts with ">")
  if (query.startsWith('>')) {
    isCommandMode.value = true
    if (commandSearchService.value) {
      suggestions.value = commandSearchService.value.searchCommands(query, {
        limit: searchLimit
      })
    }
    return
  }

  // Normal node search mode
  isCommandMode.value = false
  const queryIsEmpty = query === '' && filters.length === 0
  suggestions.value = queryIsEmpty
    ? nodeFrequencyStore.topNodeDefs
    : [
        ...nodeDefStore.nodeSearchService.searchNode(query, filters, {
          limit: searchLimit
        })
      ]
}

const emit = defineEmits<{
  (
    e: 'addFilter',
    filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
  ): void
  (
    e: 'removeFilter',
    filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
  ): void
  (e: 'addNode', nodeDef: ComfyNodeDefImpl): void
  (e: 'executeCommand', command: ComfyCommandImpl): void
}>()

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
  if (index === -1 || isCommandMode.value) {
    hoveredSuggestion.value = null
    return
  }
  const value = suggestions.value[index] as ComfyNodeDefImpl
  hoveredSuggestion.value = value
}

const onOptionSelect = (option: ComfyNodeDefImpl | ComfyCommandImpl) => {
  if (isCommandMode.value) {
    emit('executeCommand', option as ComfyCommandImpl)
  } else {
    emit('addNode', option as ComfyNodeDefImpl)
  }
}

const getOptionLabel = (
  option: ComfyNodeDefImpl | ComfyCommandImpl
): string => {
  if ('display_name' in option) {
    return option.display_name
  }
  return option.label || option.id
}

/**
 * Handles direct input changes on the AutoCompletePlus component.
 * This ensures search mode switching works properly when users clear the input
 * or modify it directly, as the @complete event may not always trigger.
 *
 * @param event - The input event from the AutoCompletePlus component
 * @note Known issue on empty input complete state:
 * https://github.com/Comfy-Org/ComfyUI_frontend/issues/4887
 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const inputValue = target.value

  // Trigger search to handle mode switching between node and command search
  if (inputValue === '') {
    search('')
  }
}
</script>
