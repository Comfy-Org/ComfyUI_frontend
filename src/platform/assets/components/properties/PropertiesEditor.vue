<template>
  <div class="group flex flex-col">
    <PropertyRow
      v-for="key in sortedKeys"
      :key="key"
      :property-key="key"
      :property="properties[key]"
      :readonly
      :is-mixed="mixedKeys?.has(key)"
      :count="propertyCounts?.get(key)"
      :total-count="totalCount"
      @update:property="(updated) => updateProperty(key, updated)"
      @delete="deleteProperty(key)"
    />
    <AddPropertyRow
      v-if="!readonly"
      :suggestions
      :existing-keys="sortedKeys"
      @add="addProperty"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  PropertySuggestion,
  UserProperties,
  UserProperty
} from '@/platform/assets/schemas/userPropertySchema'

import AddPropertyRow from './AddPropertyRow.vue'
import PropertyRow from './PropertyRow.vue'

const properties = defineModel<UserProperties>({ required: true })

const {
  suggestions = new Map(),
  readonly = false,
  totalCount,
  propertyCounts,
  mixedKeys,
  handlePropertyUpdate,
  handlePropertyDelete,
  handlePropertyAdd
} = defineProps<{
  suggestions?: Map<string, PropertySuggestion>
  readonly?: boolean
  totalCount?: number
  propertyCounts?: Map<string, number>
  mixedKeys?: Set<string>
  handlePropertyUpdate?: (key: string, property: UserProperty) => void
  handlePropertyDelete?: (key: string) => void
  handlePropertyAdd?: (key: string, property: UserProperty) => void
}>()

const sortedKeys = computed(() =>
  Object.entries(properties.value)
    .sort(([, a], [, b]) => (a._order ?? 0) - (b._order ?? 0))
    .map(([key]) => key)
)

function updateProperty(key: string, updated: UserProperty) {
  if (handlePropertyUpdate) return handlePropertyUpdate(key, updated)
  const existing = properties.value[key]
  properties.value = {
    ...properties.value,
    [key]: { ...updated, _order: existing?._order }
  }
}

function deleteProperty(key: string) {
  if (handlePropertyDelete) return handlePropertyDelete(key)
  const { [key]: _, ...rest } = properties.value
  properties.value = rest
}

function addProperty(key: string, property: UserProperty) {
  if (handlePropertyAdd) return handlePropertyAdd(key, property)
  const maxOrder = Math.max(
    0,
    ...Object.values(properties.value).map((p) => p._order ?? 0)
  )
  properties.value = {
    ...properties.value,
    [key]: { ...property, _order: maxOrder + 1 }
  }
}
</script>
