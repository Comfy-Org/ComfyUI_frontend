<template>
  <Button
    icon="pi pi-filter"
    severity="secondary"
    class="_filter-button"
    @click="showModal"
  />
  <Dialog v-model:visible="visible" class="_dialog">
    <template #header>
      <h3>Add node filter condition</h3>
    </template>
    <div class="_dialog-body">
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
    <template #footer>
      <Button type="button" label="Add" @click="submit"></Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import {
  NodeFilter,
  NodeSearchService,
  type FilterAndValue,
} from "@/services/nodeSearchService";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import SelectButton from "primevue/selectbutton";
import AutoComplete from "primevue/autocomplete";
import { inject, ref, onMounted } from "vue";

const visible = ref<boolean>(false);
const nodeSearchService: NodeSearchService = inject("nodeSearchService").value;

const filters = ref<NodeFilter[]>([]);
const selectedFilter = ref<NodeFilter>();
const filterValues = ref<string[]>([]);
const selectedFilterValue = ref<string>("");

onMounted(() => {
  filters.value = nodeSearchService.nodeFilters;
  selectedFilter.value = nodeSearchService.nodeFilters[0];
});

const emit = defineEmits(["addFilter"]);

const updateSelectedFilterValue = () => {
  updateFilterValues("");
  if (filterValues.value.includes(selectedFilterValue.value)) {
    return;
  }
  selectedFilterValue.value = filterValues.value[0];
};

const updateFilterValues = (query: string) => {
  filterValues.value = selectedFilter.value.fuseSearch.search(query);
};

const submit = () => {
  visible.value = false;
  emit("addFilter", [
    selectedFilter.value,
    selectedFilterValue.value,
  ] as FilterAndValue);
};

const showModal = () => {
  updateSelectedFilterValue();
  visible.value = true;
};
</script>

<style scoped>
._filter-button {
  z-index: 10;
}

._dialog {
  @apply min-w-96;
}

._dialog-body {
  @apply flex flex-col space-y-2;
}
</style>
