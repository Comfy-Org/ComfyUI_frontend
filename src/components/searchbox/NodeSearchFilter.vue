<template>
  <div class="_content">
    <SelectButton
      v-model="selectedFilter"
      :options="filters"
      :allowEmpty="false"
      optionLabel="name"
      @change="updateSelectedFilterValue"
    />
    <AutoComplete
      v-model="selectedFilterValue"
      :suggestions="filterValues"
      :min-length="0"
      @complete="(event) => updateFilterValues(event.query)"
      completeOnFocus
      forceSelection
      dropdown
    ></AutoComplete>
  </div>
  <div class="_footer">
    <Button type="button" label="Add" @click="submit"></Button>
  </div>
</template>

<script setup lang="ts">
import { NodeFilter, type FilterAndValue } from '@/services/nodeSearchService'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import AutoComplete from 'primevue/autocomplete'
import { ref, onMounted } from 'vue'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const filters = ref<NodeFilter[]>([])
const selectedFilter = ref<NodeFilter>()
const filterValues = ref<string[]>([])
const selectedFilterValue = ref<string>('')

onMounted(() => {
  const nodeSearchService = useNodeDefStore().nodeSearchService
  filters.value = nodeSearchService.nodeFilters
  selectedFilter.value = nodeSearchService.nodeFilters[0]
})

const emit = defineEmits(['addFilter'])

const updateSelectedFilterValue = () => {
  updateFilterValues('')
  if (filterValues.value.includes(selectedFilterValue.value)) {
    return
  }
  selectedFilterValue.value = filterValues.value[0]
}

const updateFilterValues = (query: string) => {
  filterValues.value = selectedFilter.value.fuseSearch.search(query)
}

const submit = () => {
  emit('addFilter', [
    selectedFilter.value,
    selectedFilterValue.value
  ] as FilterAndValue)
}

onMounted(updateSelectedFilterValue)
</script>

<style scoped>
._content {
  @apply flex flex-col space-y-2;
}

._footer {
  @apply flex flex-col pt-4 items-end;
}
</style>
