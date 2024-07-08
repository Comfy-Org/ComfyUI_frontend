<template>
  <div>
    <Dialog v-model:visible="visible" pt:root:class="invisible-dialog-root">
      <template #container="{ closeCallback }">
        <NodeSearchBox
          :filters="nodeFilters"
          @add-filter="addFilter"
          @remove-filter="removeFilter"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { inject, onMounted, onUnmounted, reactive, Ref, ref } from "vue";
import NodeSearchBox from "./NodeSearchBox.vue";
import Dialog from "primevue/dialog";
import { LiteGraphCanvasEvent } from "@comfyorg/litegraph";
import {
  FilterAndValue,
  NodeSearchService,
} from "@/services/nodeSearchService";

const visible = ref(false);
const nodeFilters = reactive([]);
const addFilter = (filter: FilterAndValue) => {
  nodeFilters.push(filter);
};
const removeFilter = (filter: FilterAndValue) => {
  const index = nodeFilters.findIndex((f) => f === filter);
  if (index !== -1) {
    nodeFilters.splice(index, 1);
  }
};
const nodeSearchService = (
  inject("nodeSearchService") as Ref<NodeSearchService>
).value;

const canvasEventHandler = (e: LiteGraphCanvasEvent) => {
  const shiftPressed = (e.detail.originalEvent as KeyboardEvent).shiftKey;
  if (e.detail.subType === "empty-release" && shiftPressed) {
    const destIsInput = e.detail.linkReleaseContext.node_from !== undefined;
    const filter = destIsInput
      ? nodeSearchService.getFilterById("input")
      : nodeSearchService.getFilterById("output");
    const value = destIsInput
      ? e.detail.linkReleaseContext.type_filter_in
      : e.detail.linkReleaseContext.type_filter_out;

    addFilter([filter, value]);
  }
  visible.value = true;
};

onMounted(() => {
  document.addEventListener("litegraph:canvas", canvasEventHandler);
});

onUnmounted(() => {
  document.removeEventListener("litegraph:canvas", canvasEventHandler);
});
</script>

<style>
.invisible-dialog-root {
  width: 30%;
  min-width: 24rem;
  max-width: 48rem;
  border: 0 !important;
  background-color: transparent !important;
}
</style>
