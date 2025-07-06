<template>
  <div class="_content">
    <SelectButton
      v-model="selectedFilter"
      class="filter-type-select"
      :options="filters"
      :allow-empty="false"
      option-label="name"
      @change="updateSelectedFilterValue"
    />
    <Select
      v-model="selectedFilterValue"
      class="filter-value-select"
      :options="filterValues"
      filter
      auto-filter-focus
    />
  </div>
  <div class="_footer">
    <Button type="button" :label="$t('g.add')" @click="submit" />
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref } from 'vue'

import { ComfyNodeDefImpl, useNodeDefStore } from '@/stores/nodeDefStore'
import { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

const filters = computed(() => nodeDefStore.nodeSearchService.nodeFilters)
const selectedFilter = ref<FuseFilter<ComfyNodeDefImpl, string>>()
const filterValues = computed(() => selectedFilter.value?.fuseSearch.data ?? [])
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
  if (filterValues.value.includes(selectedFilterValue.value)) {
    return
  }
  selectedFilterValue.value = filterValues.value[0]
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

<style scoped>
._content {
  @apply flex flex-col space-y-2;
}

._footer {
  @apply flex flex-col pt-4 items-end;
}
</style>
