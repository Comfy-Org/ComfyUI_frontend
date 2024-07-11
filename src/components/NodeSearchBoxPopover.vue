<template>
  <div>
    <Dialog
      v-model:visible="visible"
      pt:root:class="invisible-dialog-root"
      dismissable-mask
      modal
    >
      <template #container>
        <NodeSearchBox
          :filters="nodeFilters"
          @add-filter="addFilter"
          @remove-filter="removeFilter"
          @add-node="addNode"
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { app } from "@/scripts/app";
import { inject, onMounted, onUnmounted, reactive, Ref, ref } from "vue";
import NodeSearchBox from "./NodeSearchBox.vue";
import Dialog from "primevue/dialog";
import { LiteGraph, LiteGraphCanvasEvent } from "@comfyorg/litegraph";
import {
  FilterAndValue,
  NodeSearchService,
} from "@/services/nodeSearchService";
import { ComfyNodeDef } from "@/types/apiTypes";

interface LiteGraphPointerEvent extends Event {
  canvasX: number;
  canvasY: number;
}

const visible = ref(false);
const triggerEvent = ref<LiteGraphCanvasEvent | null>(null);
const getNewNodeLocation = (): [number, number] => {
  if (triggerEvent.value === null) {
    return [100, 100];
  }

  const originalEvent = triggerEvent.value.detail
    .originalEvent as LiteGraphPointerEvent;
  return [originalEvent.canvasX, originalEvent.canvasY];
};
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
const clearFilters = () => {
  nodeFilters.splice(0, nodeFilters.length);
};
const closeDialog = () => {
  clearFilters();
  visible.value = false;
};
const addNode = (nodeDef: ComfyNodeDef) => {
  closeDialog();
  const node = LiteGraph.createNode(nodeDef.name, nodeDef.display_name, {});
  if (node) {
    node.pos = getNewNodeLocation();
    app.graph.add(node);
  }
};
const nodeSearchService = (
  inject("nodeSearchService") as Ref<NodeSearchService>
).value;

const canvasEventHandler = (e: LiteGraphCanvasEvent) => {
  const shiftPressed = (e.detail.originalEvent as KeyboardEvent).shiftKey;
  // Ignore empty releases unless shift is pressed
  // Empty release without shift is trigger right click menu
  if (e.detail.subType === "empty-release" && !shiftPressed) {
    return;
  }

  if (e.detail.subType === "empty-release") {
    const destIsInput = e.detail.linkReleaseContext.node_from !== undefined;
    const filter = destIsInput
      ? nodeSearchService.getFilterById("input")
      : nodeSearchService.getFilterById("output");
    const value = destIsInput
      ? e.detail.linkReleaseContext.type_filter_in
      : e.detail.linkReleaseContext.type_filter_out;

    addFilter([filter, value]);
  }
  triggerEvent.value = e;
  visible.value = true;
};

const handleEscapeKeyPress = (event) => {
  if (event.key === "Escape") {
    closeDialog();
  }
};

onMounted(() => {
  document.addEventListener("litegraph:canvas", canvasEventHandler);
  document.addEventListener("keydown", handleEscapeKeyPress);
});

onUnmounted(() => {
  document.removeEventListener("litegraph:canvas", canvasEventHandler);
  document.removeEventListener("keydown", handleEscapeKeyPress);
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
