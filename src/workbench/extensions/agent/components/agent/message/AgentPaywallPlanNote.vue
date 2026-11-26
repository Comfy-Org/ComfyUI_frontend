<script setup lang="ts">
import { computed } from 'vue'

import { TOP_UP_PLAN_CREDIT_LINE_KEYS } from '@/platform/billing/composables/useTopUpPlanCreditCopy'
import type { AgentPaywallPresentation } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const { presentation } = defineProps<{
  presentation: AgentPaywallPresentation
}>()

const noteKey = computed(() =>
  presentation.kind === 'subscribed' && presentation.planCreditLine
    ? TOP_UP_PLAN_CREDIT_LINE_KEYS[presentation.planCreditLine]
    : null
)
</script>

<template>
  <p
    v-if="noteKey"
    data-testid="agent-paywall-plan-note"
    class="m-0 mt-1 text-muted-foreground"
  >
    {{ $t(noteKey) }}
  </p>
</template>
