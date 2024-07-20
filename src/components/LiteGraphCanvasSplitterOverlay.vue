<template>
  <Splitter class="splitter-overlay">
    <SplitterPanel class="side-bar-panel">
      <div>Placeholder</div>
    </SplitterPanel>
    <SplitterPanel class="graph-canvas-panel">
      <div></div>
    </SplitterPanel>
  </Splitter>
</template>

<script setup lang="ts">
import Splitter from "primevue/splitter";
import SplitterPanel from "primevue/splitterpanel";
</script>

<style>
.p-splitter-gutter {
  pointer-events: auto;
}
</style>
<style scoped>
.side-bar-panel {
  background-color: var(--bg-color);
  pointer-events: auto;
}

.splitter-overlay {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: transparent;
  pointer-events: none;
  z-index: 10;
}
</style>
