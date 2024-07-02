<template>
  <Button
    icon="pi pi-filter"
    severity="secondary"
    class="filter-button"
    @click="showModal"
  />
  <Dialog v-model:visible="visible" class="dialog">
    <template #header>
      <h3>Add node filter condition</h3>
    </template>
    <Select
      v-model="selectedFilterType"
      :options="filterTypes"
      optionLabel="displayText"
      @change="updateSelectedFilterOption"
    />
    <AutoComplete
      v-model="selectedFilterOption"
      :suggestions="filterOptions"
      :min-length="0"
      @complete="search"
      completeOnFocus
      forceSelection
      dropdown
    ></AutoComplete>
    <template #footer>
      <Button type="button" label="Add" @click="submit"></Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import {
  NodeFilter,
  NodeFilterType,
  NodeSearchService,
} from "@/services/nodeSearchService";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import Select from "primevue/select";
import AutoComplete from "primevue/autocomplete";
import { ref } from "vue";

const visible = ref<boolean>(false);
const filterTypes = NodeSearchService.SUPPORTED_NODE_FILTER_TYPES;
const selectedFilterType = ref<NodeFilterType>(filterTypes[0]);

const filterOptions = ref<string[]>([]);
const selectedFilterOption = ref<string>("");

const emit = defineEmits(["addFilter"]);

const updateSelectedFilterOption = () => {
  search({ query: "" });
  if (filterOptions.value.includes(selectedFilterOption.value)) {
    return;
  }
  selectedFilterOption.value = filterOptions.value[0];
};

const search = (event: { query: string }) => {
  filterOptions.value =
    event.query === ""
      ? // Copy array. Otherwise, Vue will have some reactive bugs.
        [
          ...NodeSearchService.getInstance().filterOptions[
            selectedFilterType.value.name
          ],
        ]
      : NodeSearchService.getInstance().searchFilter(
          event.query,
          selectedFilterType.value
        );
};

const submit = () => {
  visible.value = false;
  emit("addFilter", {
    type: selectedFilterType.value,
    value: selectedFilterOption.value,
  } as NodeFilter);
};

const showModal = () => {
  updateSelectedFilterOption();
  visible.value = true;
};
</script>

<style scoped>
.filter-button {
  z-index: 10;
}
</style>
