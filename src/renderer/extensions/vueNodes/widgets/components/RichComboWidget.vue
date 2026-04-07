<script setup lang="ts">
import { computed, onMounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { FilterOption } from '@/platform/assets/types/filterTypes'
import { isComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import FormDropdown from './form/dropdown/FormDropdown.vue'
import type { FormDropdownItem, LayoutMode } from './form/dropdown/types'
import { AssetKindKey } from './form/dropdown/types'
import {
  buildSearchText,
  extractFilterValues,
  getByPath,
  mapToDropdownItem
} from '../utils/resolveItemSchema'
import { fetchRemoteRoute } from '../utils/resolveRemoteRoute'

const props = defineProps<{
  modelValue?: string
  widget: SimplifiedWidget<string | undefined>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

const comboSpec = computed(() => {
  if (props.widget.spec && isComboInputSpec(props.widget.spec)) {
    return props.widget.spec
  }
  return undefined
})
const remoteConfig = computed(() => comboSpec.value?.remote!)
const itemSchema = computed(() => remoteConfig.value?.item_schema!)

const rawItems = ref<unknown[]>([])
const loading = ref(false)

async function fetchItems() {
  loading.value = true
  try {
    const res = await fetchRemoteRoute(remoteConfig.value.route, {
      params: remoteConfig.value.query_params,
      timeout: remoteConfig.value.timeout ?? 30000,
      useComfyApi: remoteConfig.value.use_comfy_api
    })
    const data = remoteConfig.value.response_key
      ? res.data[remoteConfig.value.response_key]
      : res.data
    rawItems.value = Array.isArray(data) ? data : []
  } catch (err) {
    console.error('RichComboWidget: fetch error', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchItems()
})

const assetKind = computed(() => {
  const pt = itemSchema.value.preview_type ?? 'image'
  return pt as 'image' | 'video' | 'audio'
})

provide(AssetKindKey, assetKind)

const items = computed<FormDropdownItem[]>(() =>
  rawItems.value.map((raw) => mapToDropdownItem(raw, itemSchema.value))
)

const searchIndex = computed(() => {
  const schema = itemSchema.value
  const fields = schema.search_fields ?? [schema.label_field]
  const index = new Map<string, string>()
  for (const raw of rawItems.value) {
    const id = String(getByPath(raw, schema.value_field) ?? '')
    index.set(id, buildSearchText(raw, fields))
  }
  return index
})

const filterOptions = computed<FilterOption[]>(() => {
  const schema = itemSchema.value
  if (!schema.filter_field) return []
  const values = extractFilterValues(rawItems.value, schema.filter_field)
  return [
    { name: 'All', value: 'all' },
    ...values.map((v) => ({ name: v, value: v }))
  ]
})

const filterSelected = ref('all')
const layoutMode = ref<LayoutMode>('list')
const selectedSet = ref<Set<string>>(new Set())

const filteredItems = computed<FormDropdownItem[]>(() => {
  const schema = itemSchema.value
  if (filterSelected.value === 'all' || !schema.filter_field) {
    return items.value
  }
  const filterField = schema.filter_field
  return rawItems.value
    .filter(
      (raw) =>
        String(getByPath(raw, filterField) ?? '') === filterSelected.value
    )
    .map((raw) => mapToDropdownItem(raw, schema))
})

async function searcher(
  query: string,
  searchItems: FormDropdownItem[],
  _onCleanup: (cleanupFn: () => void) => void
): Promise<FormDropdownItem[]> {
  if (!query.trim()) return searchItems
  const q = query.toLowerCase()
  return searchItems.filter((item) => {
    const text = searchIndex.value.get(item.id) ?? item.name.toLowerCase()
    return text.includes(q)
  })
}

watch(
  [() => props.modelValue, items],
  ([val]) => {
    selectedSet.value.clear()
    if (val) {
      const item = items.value.find((i) => i.id === val)
      if (item) selectedSet.value.add(item.id)
    }
  },
  { immediate: true }
)

function handleRefresh() {
  void fetchItems()
}

function handleSelection(selected: Set<string>) {
  const id = selected.values().next().value
  if (id) {
    emit('update:modelValue', id)
  }
}
</script>

<template>
  <div class="flex w-full items-center gap-1">
    <FormDropdown
      v-model:selected="selectedSet"
      v-model:filter-selected="filterSelected"
      v-model:layout-mode="layoutMode"
      :items="filteredItems"
      :placeholder="loading ? 'Loading...' : t('widgets.uploadSelect.placeholder')"
      :multiple="false"
      :filter-options="[]"
      :show-sort="false"
      :show-layout-switcher="false"
      :searcher="searcher"
      class="flex-1"
      @update:selected="handleSelection"
    />
    <button
      v-if="remoteConfig?.refresh_button !== false"
      class="flex size-7 shrink-0 items-center justify-center rounded text-secondary hover:bg-component-node-widget-background-hovered"
      title="Refresh"
      @pointerdown.stop
      @click.stop="handleRefresh"
    >
      <i
        :class="[
          'icon-[lucide--refresh-cw] size-3.5',
          loading && 'animate-spin'
        ]"
      />
    </button>
  </div>
</template>
