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
      <!-- FilterAndValue -->
      <template v-slot:chip="{ value }">
        <Chip
          removable
          @remove="activeFilters = activeFilters.filter((f) => f !== value)"
        >
          <Badge size="small" :class="value[0].invokeSequence + '-badge'">
            {{ value[0].invokeSequence.toUpperCase() }}
          </Badge>
          {{ value[1] }}
        </Chip>
      </template>
    </AutoComplete>
  </div>
</template>

<script setup lang="ts">
import { inject, Ref, ref } from "vue";
import AutoComplete from "primevue/autocomplete";
import Chip from "primevue/chip";
import Badge from "primevue/badge";
import NodeSearchFilter from "@/components/NodeSearchFilter.vue";
import NodeSourceChip from "@/components/NodeSourceChip.vue";
import { ComfyNodeDef } from "@/types/apiTypes";
import {
  NodeSearchService,
  type FilterAndValue,
} from "@/services/nodeSearchService";
import { LinkReleaseContext } from "@comfyorg/litegraph";

const props = defineProps({
  searchLimit: {
    type: Number,
    default: 10,
  },
  triggerEvent: {
    type: CustomEvent<{
      subType: string;
      originalEvent: Event;
      linkReleaseContext?: LinkReleaseContext;
    }>,
    required: false,
  },
});

const nodeSearchService = (
  inject("nodeSearchService") as Ref<NodeSearchService>
).value;

const activeFilters = ref<FilterAndValue[]>([]);
const suggestions = ref<ComfyNodeDef[]>([]);

const search = (event: { query: string }) => {
  const query = event.query;
  suggestions.value = nodeSearchService.searchNode(query, activeFilters.value, {
    limit: props.searchLimit,
  });
};

const addFilter = (filter: FilterAndValue<string>) => {
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

.i-badge {
  @apply bg-green-500 text-white;
}

.o-badge {
  @apply bg-red-500 text-white;
}

.c-badge {
  @apply bg-blue-500 text-white;
}

.s-badge {
  @apply bg-yellow-500;
}
</style>
