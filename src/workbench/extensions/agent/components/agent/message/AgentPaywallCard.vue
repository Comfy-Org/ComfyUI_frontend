<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { computed } from 'vue'

import Button from '@comfyorg/design-system/button/Button'

import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  toAgentPaywallRemediation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const { presentation = DEFAULT_AGENT_PAYWALL_PRESENTATION, message } =
  defineProps<{
    presentation?: AgentPaywallPresentation
    message?: string
  }>()
const emit = defineEmits<{
  paywallAction: [action: AgentPaywallAction]
}>()

const bodyKeys: Record<AgentPaywallPresentation['kind'], string> = {
  subscribed: 'agent.paywall.body.subscribed',
  subscriptionRequired: 'agent.paywall.body.subscriptionRequired',
  member: 'agent.paywall.body.member',
  salesManaged: 'agent.paywall.body.salesManaged',
  local: 'agent.paywall.body.local',
  unavailable: 'agent.paywall.body.subscriptionRequired'
}
const bodyKey = computed(() => bodyKeys[presentation.kind])
const showUpgrade = computed(
  () => presentation.kind === 'subscribed' && presentation.showUpgrade
)
const remediation = computed(() => toAgentPaywallRemediation(presentation))
const showSubscribe = computed(() => remediation.value === 'subscribe')
const showAddCredits = computed(() => remediation.value === 'addCredits')
</script>

<template>
  <Card
    surface="secondary"
    role="alert"
    class="flex w-full flex-col justify-center gap-2 overflow-hidden p-4 shadow-sm"
  >
    <div class="flex w-full items-start gap-2">
      <i
        aria-hidden="true"
        class="mt-0.5 icon-[lucide--gauge] size-5 text-destructive"
      />
      <div class="min-w-0 flex-1 text-sm/5">
        <p class="m-0">
          {{ $t('agent.paywall.title') }}
        </p>
        <p class="m-0 text-muted-foreground">
          {{ message || $t(bodyKey) }}
        </p>
      </div>
    </div>

    <div
      v-if="showAddCredits || showSubscribe || showUpgrade"
      class="flex w-full justify-end gap-2"
    >
      <Button
        v-if="showUpgrade"
        variant="secondary"
        size="sm"
        @click="emit('paywallAction', 'upgrade')"
      >
        {{ $t('agent.paywall.upgradePlan') }}
      </Button>
      <Button
        v-if="showSubscribe"
        variant="inverted"
        size="sm"
        @click="emit('paywallAction', 'subscribe')"
      >
        {{ $t('agent.paywall.subscribe') }}
      </Button>
      <Button
        v-if="showAddCredits"
        variant="inverted"
        size="sm"
        @click="emit('paywallAction', 'addCredits')"
      >
        {{ $t('agent.paywall.addCredits') }}
      </Button>
    </div>
  </Card>
</template>
