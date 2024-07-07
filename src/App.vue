<template>
  <ProgressSpinner v-if="isLoading"></ProgressSpinner>
  <div v-else>
    <NodeSearchBox></NodeSearchBox>
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide, ref } from "vue";
import NodeSearchBox from "@/components/NodeSearchBox.vue";
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

<style></style>
