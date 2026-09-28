<script setup lang="ts">
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

import AgentPaywallCard from './AgentPaywallCard.vue'

defineProps<{
  visible: boolean
  presentation: AgentPaywallPresentation
}>()

defineEmits<{
  paywallAction: [action: AgentPaywallAction]
}>()
</script>

<template>
  <AgentPaywallCard
    v-if="visible"
    data-testid="agent-credits-exhausted-paywall"
    :presentation="presentation"
    @paywall-action="$emit('paywallAction', $event)"
  />
</template>
