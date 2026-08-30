<template>
  <div class="flex flex-col gap-2">
    <ToggleGroup
      v-model="selectedFilterName"
      type="single"
      class="filter-type-select"
    >
      <ToggleGroupItem
        v-for="filter in filters"
        :key="filter.name"
        :value="filter.name"
      >
        {{ filter.name }}
      </ToggleGroupItem>
    </ToggleGroup>
    <SingleSelect
      v-model="selectedFilterValue"
      class="filter-value-select"
      :options="filterValues"
    />
  </div>
  <div class="flex flex-col items-end pt-4">
    <Button type="button" @click="submit">{{ $t('g.add') }}</Button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

const filters = computed(() => nodeDefStore.nodeSearchService.nodeFilters)
const selectedFilter = ref<FuseFilter<ComfyNodeDefImpl, string>>()
const selectedFilterName = computed({
  get: () => selectedFilter.value?.name,
  set: (name: string) => {
    const filter = filters.value.find((filter) => filter.name === name)
    if (!filter) return

    selectedFilter.value = filter
    updateSelectedFilterValue()
  }
})
const filterValues = computed(() =>
  (selectedFilter.value?.fuseSearch.data ?? []).map((value) => ({
    name: value,
    value
  }))
)
const selectedFilterValue = ref<string>('')

const nodeDefStore = useNodeDefStore()

onMounted(() => {
  selectedFilter.value = nodeDefStore.nodeSearchService.nodeFilters[0]
  updateSelectedFilterValue()
})

const emit = defineEmits<{
  (
    event: 'addFilter',
    filterAndValue: FuseFilterWithValue<ComfyNodeDefImpl, string>
  ): void
}>()

const updateSelectedFilterValue = () => {
  if (
    filterValues.value.some(({ value }) => value === selectedFilterValue.value)
  ) {
    return
  }
  selectedFilterValue.value = String(filterValues.value[0]?.value ?? '')
}

const submit = () => {
  if (!selectedFilter.value) {
    return
  }
  emit('addFilter', {
    filterDef: selectedFilter.value,
    value: selectedFilterValue.value
  })
}
</script>
