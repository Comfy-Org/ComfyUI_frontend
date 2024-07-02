<template>
  <NodeSearchBox :nodes="nodeDefs"></NodeSearchBox>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import NodeSearchBox from "@/components/NodeSearchBox.vue";

import { api } from "@/scripts/api";
import { ComfyNodeDef } from "./types/apiTypes";
import { NodeSearchService } from "./services/nodeSearchService";

const nodeDefs = ref<ComfyNodeDef[]>([]);

onMounted(async () => {
  nodeDefs.value = Object.values(await api.getNodeDefs());
  // Initialize node search service
  NodeSearchService.getInstance(nodeDefs.value);
});
</script>

<style></style>
