<template>
  <div class="_content">
    <SelectButton
      class="filter-type-select"
      v-model="selectedFilter"
      :options="filters"
      :allowEmpty="false"
      optionLabel="name"
      @change="updateSelectedFilterValue"
    />
    <Select
      class="filter-value-select"
      v-model="selectedFilterValue"
      :options="filterValues"
      filter
      autoFilterFocus
    />
  </div>
  <div class="_footer">
    <Button type="button" :label="$t('g.add')" @click="submit"></Button>
  </div>
</template>

<script setup lang="ts">
import { NodeFilter, type FilterAndValue } from '@/services/nodeSearchService'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Select from 'primevue/select'
import { ref, onMounted, computed } from 'vue'
import { useNodeDefStore } from '@/stores/nodeDefStore'

const filters = computed(() => nodeDefStore.nodeSearchService.nodeFilters)
const selectedFilter = ref<NodeFilter>()
const filterValues = computed(() => selectedFilter.value?.fuseSearch.data ?? [])
const selectedFilterValue = ref<string>('')

const nodeDefStore = useNodeDefStore()

onMounted(() => {
  selectedFilter.value = nodeDefStore.nodeSearchService.nodeFilters[0]
  updateSelectedFilterValue()
})

const emit = defineEmits<{
  (event: 'addFilter', filterAndValue: FilterAndValue): void
}>()

const updateSelectedFilterValue = () => {
  if (filterValues.value.includes(selectedFilterValue.value)) {
    return
  }
  selectedFilterValue.value = filterValues.value[0]
}

const submit = () => {
  emit('addFilter', [
    selectedFilter.value,
    selectedFilterValue.value
  ] as FilterAndValue)
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
