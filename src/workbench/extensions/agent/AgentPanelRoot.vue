<script setup lang="ts">
import { useAgentFeatureGate } from './composables/agent/useAgentFeatureGate'
import AgentPanelRuntimeRoot from './AgentPanelRuntimeRoot.vue'

const enabled = useAgentFeatureGate()
</script>

<template>
  <AgentPanelRuntimeRoot v-if="enabled" />
</template>
