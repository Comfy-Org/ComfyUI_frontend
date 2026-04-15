<template>
  <div class="group flex flex-col">
    <PropertyRow
      v-for="key in orderedKeys"
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
      :existing-keys="orderedKeys"
      @add="addProperty"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

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
  mixedKeys
} = defineProps<{
  suggestions?: Map<string, PropertySuggestion>
  readonly?: boolean
  totalCount?: number
  propertyCounts?: Map<string, number>
  mixedKeys?: Set<string>
}>()

const orderedKeys = ref<string[]>(Object.keys(properties.value))

watch(
  () => properties.value,
  (props) => {
    const current = new Set(orderedKeys.value)
    const actual = new Set(Object.keys(props))
    orderedKeys.value = orderedKeys.value.filter((k) => actual.has(k))
    for (const k of actual) {
      if (!current.has(k)) orderedKeys.value.push(k)
    }
  },
  { deep: true }
)

function updateProperty(key: string, updated: UserProperty) {
  properties.value = { ...properties.value, [key]: updated }
}

function deleteProperty(key: string) {
  const { [key]: _, ...rest } = properties.value
  properties.value = rest
  orderedKeys.value = orderedKeys.value.filter((k) => k !== key)
}

function addProperty(key: string, property: UserProperty) {
  properties.value = { ...properties.value, [key]: property }
  orderedKeys.value.push(key)
}
</script>
