<template>
  <div class="_content">
    <div
      class="filter-type-group"
      role="tablist"
      :aria-label="$t('sideToolbar.nodeLibraryTab.filterCategory')"
    >
      <Button
        v-for="filterOption in filters"
        :key="filterOption.id"
        type="button"
        size="sm"
        :variant="
          selectedFilter?.id === filterOption.id
            ? 'secondary'
            : 'muted-textonly'
        "
        class="filter-type-button"
        :aria-pressed="selectedFilter?.id === filterOption.id"
        @click="selectFilterOption(filterOption)"
      >
        {{ filterOption.name }}
      </Button>
    </div>
    <Select
      v-model="selectedFilterValue"
      class="filter-value-select"
      :options="filterValues"
      filter
      auto-filter-focus
    />
  </div>
  <div class="_footer">
    <Button type="button" @click="submit">{{ $t('g.add') }}</Button>
  </div>
</template>

<script setup lang="ts">
import Select from 'primevue/select'
import { computed, onMounted, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import type { FuseFilter, FuseFilterWithValue } from '@/utils/fuseUtil'

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

const selectFilterOption = (
  filterOption: FuseFilter<ComfyNodeDefImpl, string>
) => {
  if (selectedFilter.value?.id === filterOption.id) {
    return
  }
  selectedFilter.value = filterOption
  updateSelectedFilterValue()
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
@reference '../../assets/css/style.css';

._content {
  @apply flex flex-col space-y-2;
}

.filter-type-group {
  @apply flex flex-wrap gap-2;
}

.filter-type-button {
  @apply flex-1 justify-center px-3 py-2 text-sm;
}

._footer {
  @apply flex flex-col pt-4 items-end;
}
</style>
