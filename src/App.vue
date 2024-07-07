<template>
  <ProgressSpinner v-if="isLoading" class="spinner"></ProgressSpinner>
  <div v-else>
    <NodeSearchboxPopover />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import NodeSearchboxPopover from "@/components/NodeSearchBoxPopover.vue";
import ProgressSpinner from "primevue/progressspinner";
import { api } from "@/scripts/api";
import { NodeSearchService } from "./services/nodeSearchService";

const isLoading = ref(true);
const nodeSearchService = ref<NodeSearchService>();

onMounted(async () => {
  const nodeDefs = Object.values(await api.getNodeDefs());
  nodeSearchService.value = new NodeSearchService(nodeDefs);
  isLoading.value = false;
});

provide("nodeSearchService", nodeSearchService);
</script>

<style scoped>
.spinner {
  @apply absolute inset-0 flex justify-center items-center h-screen;
}
</style>
