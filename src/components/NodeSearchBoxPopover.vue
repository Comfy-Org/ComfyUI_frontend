<template>
  <div>
    <Dialog v-model:visible="visible">
      <template #container="{ closeCallback }">
        <NodeSearchBox />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import NodeSearchBox from "./NodeSearchBox.vue";
import Dialog from "primevue/dialog";
import { LiteGraphCanvasEvent } from "@comfyorg/litegraph";

const visible = ref(false);

const canvasEventHandler = (e: LiteGraphCanvasEvent) => {
  if (e.detail.subType === "empty-release") {
    console.log(e.detail.linkReleaseContext!);
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
