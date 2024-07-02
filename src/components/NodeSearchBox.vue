<template>
  <div class="comfy-vue-node-search-container">
    <NodeSearchFilter @addFilter="addFilter" />
    <AutoComplete
      v-model="activeFilters"
      class="comfy-vue-node-search-box"
      scrollHeight="28rem"
      placeholder="Search for nodes..."
      appendTo="self"
      :suggestions="suggestions"
      :min-length="0"
      @complete="search"
      complete-on-focus
      forceSelection
      multiple
    >
      <template v-slot:option="{ option }">
        <div class="option-container">
          <div class="option-display-name">
            {{ option.display_name }}
            <NodeSourceChip
              v-if="option.python_module !== undefined"
              :python_module="option.python_module"
            />
          </div>
          <div v-if="option.description" class="option-description">
            {{ option.description }}
          </div>
        </div>
      </template>
      <template v-slot:chip="{ value }">
        <Chip
          :label="value.type.invokeSequences[1] + ': ' + value.value"
          removable
          @remove="activeFilters = activeFilters.filter((f) => f !== value)"
        />
      </template>
    </AutoComplete>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import AutoComplete from "primevue/autocomplete";
import Chip from "primevue/chip";
import NodeSearchFilter from "@/components/NodeSearchFilter.vue";
import NodeSourceChip from "@/components/NodeSourceChip.vue";
import { ComfyNodeDef } from "@/types/apiTypes";
import {
  NodeSearchService,
  type NodeFilter,
} from "@/services/nodeSearchService";

const props = defineProps({
  nodes: {
    type: Array<ComfyNodeDef>,
    default: [],
  },
  debounceTimeout: {
    type: Number,
    default: 300,
  },
  searchLimit: {
    type: Number,
    default: 10,
  },
});

const activeFilters = ref<NodeFilter[]>([]);
const suggestions = ref<ComfyNodeDef[]>([]);

const search = (event: { query: string }) => {
  const query = event.query;
  suggestions.value = NodeSearchService.getInstance().searchNode(
    query,
    activeFilters.value,
    { limit: props.searchLimit }
  );
};

const addFilter = (filter: NodeFilter) => {
  activeFilters.value.push(filter);
};
</script>

<style scoped>
.comfy-vue-node-search-container {
  @apply flex justify-center items-center h-screen;
}

.comfy-vue-node-search-container * {
  pointer-events: auto;
}

.comfy-vue-node-search-box {
  @apply min-w-96 w-1/4 z-10;
}

.option-container {
  @apply flex flex-col px-4 py-2 cursor-pointer overflow-hidden;
}

.option-container:hover .option-description {
  @apply overflow-visible;
  /* Allows text to wrap */
  white-space: normal;
}

.option-display-name {
  @apply font-semibold;
}

.option-description {
  @apply text-sm text-gray-400 overflow-hidden text-ellipsis;
  /* Keeps the text on a single line by default */
  white-space: nowrap;
}
</style>
