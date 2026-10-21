<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import Message from '@/components/ui/message/Message.vue'

import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
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
const showSubscribe = computed(
  () => presentation.kind === 'subscriptionRequired'
)
const showAddCredits = computed(
  () => presentation.kind === 'subscribed' || presentation.kind === 'local'
)
</script>

<template>
  <Message severity="error">
    <template #icon>
      <span class="mt-0.5 icon-[lucide--gauge] block size-4" />
    </template>
    <div class="flex flex-col gap-2">
      <div>
        <p class="m-0">
          {{ $t('agent.paywall.title') }}
        </p>
        <p class="m-0 text-muted-foreground">
          {{ message || $t(bodyKey) }}
        </p>
      </div>

      <div
        v-if="showAddCredits || showSubscribe || showUpgrade"
        class="flex justify-end gap-2"
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
    </div>
  </Message>
</template>
