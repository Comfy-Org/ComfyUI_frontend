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
            <div>
              <span
                v-html="highlightQuery(option.display_name, currentQuery)"
              ></span>
              <span>&nbsp;</span>
              <Tag
                v-if="showUniqueName"
                class="option-unique-name"
                severity="secondary"
              >
                <span v-html="highlightQuery(option.name, currentQuery)"></span>
              </Tag>
            </div>
            <div v-if="showCategory" class="option-category">
              {{ option.category.replaceAll('/', ' > ') }}
            </div>
          </div>
          <div class="option-badges">
            <Tag
              v-if="option.experimental"
              :value="$t('experimental')"
              severity="primary"
            />
            <Tag
              v-if="option.deprecated"
              :value="$t('deprecated')"
              severity="danger"
            />
            <NodeSourceChip
              v-if="option.python_module !== undefined"
              :python_module="option.python_module"
            />
          </div>
        </div>
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
import Tag from 'primevue/tag'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import NodeSearchFilter from '@/components/searchbox/NodeSearchFilter.vue'
import NodeSourceChip from '@/components/node/NodeSourceChip.vue'
import { type FilterAndValue } from '@/services/nodeSearchService'
import NodePreview from '@/components/node/NodePreview.vue'
import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { useSettingStore } from '@/stores/settingStore'
import { useI18n } from 'vue-i18n'
import SearchFilterChip from '../common/SearchFilterChip.vue'

const settingStore = useSettingStore()
const { t } = useI18n()

const enableNodePreview = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.NodePreview')
)
const showCategory = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowCategory')
)
const showUniqueName = computed(() =>
  settingStore.get('Comfy.NodeSearchBoxImpl.ShowUniqueName')
)

const props = defineProps({
  filters: {
    type: Array<FilterAndValue>
  },
  searchLimit: {
    type: Number,
    default: 64
  }
})

const nodeSearchFilterVisible = ref(false)
const inputId = `comfy-vue-node-search-box-input-${Math.random()}`
const suggestions = ref<ComfyNodeDefImpl[]>([])
const hoveredSuggestion = ref<ComfyNodeDefImpl | null>(null)
const currentQuery = ref('')
const placeholder = computed(() => {
  return props.filters.length === 0 ? t('searchNodes') + '...' : ''
})

const search = (query: string) => {
  currentQuery.value = query
  suggestions.value = [
    ...useNodeDefStore().nodeSearchService.searchNode(query, props.filters, {
      limit: props.searchLimit
    })
  ]
}

const highlightQuery = (text: string, query: string) => {
  if (!query) return text
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<span class="highlight">$1</span>')
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

.option-container {
  @apply flex justify-between items-center px-2 py-0 cursor-pointer overflow-hidden w-full;
}

.option-display-name {
  @apply font-semibold flex flex-col;
}

.option-category {
  @apply font-light text-sm text-gray-400 overflow-hidden text-ellipsis;
  /* Keeps the text on a single line by default */
  white-space: nowrap;
}

:deep(.highlight) {
  background-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-weight: bold;
  border-radius: 0.25rem;
  padding: 0rem 0.125rem;
  margin: -0.125rem 0.125rem;
}

._filter-button {
  z-index: 10;
}

._dialog {
  @apply min-w-96;
}
</style>
