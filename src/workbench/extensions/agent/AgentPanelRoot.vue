<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useAgentPanelStore } from './stores/agent/agentPanelStore'
import AgentPanelRuntimeRoot from './AgentPanelRuntimeRoot.vue'

const { enabled } = storeToRefs(useAgentPanelStore())
</script>

<template>
  <AgentPanelRuntimeRoot v-if="enabled" />
</template>
