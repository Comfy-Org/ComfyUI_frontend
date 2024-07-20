<template>
  <div ref="container" id="vue-graph-canvas-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";

const canvasId = "graph-canvas";
const canvasContainerId = "graph-canvas-container";

const container = ref(null);

onMounted(() => {
  const externalElement = document.getElementById(canvasId);
  if (externalElement && container.value) {
    container.value.appendChild(externalElement);
  }
});

onBeforeUnmount(() => {
  // Move the element back to its original location
  const canvasContainer = document.getElementById(canvasContainerId);
  const canvas = document.getElementById(canvasId);
  if (canvasContainer && canvas) {
    canvasContainer.appendChild(canvas);
  }
});
</script>

<style>
#vue-graph-canvas-container {
  width: 100%;
  height: 100%;
}
</style>
