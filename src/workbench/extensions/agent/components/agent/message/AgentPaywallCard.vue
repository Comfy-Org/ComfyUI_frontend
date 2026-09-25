<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const { presentation = DEFAULT_AGENT_PAYWALL_PRESENTATION } = defineProps<{
  presentation?: AgentPaywallPresentation
}>()
const emit = defineEmits<{
  paywallAction: [action: AgentPaywallAction]
}>()

const bodyKeys: Record<AgentPaywallPresentation['kind'], string> = {
  subscribed: 'agent.paywall.body.subscribed',
  subscriptionRequired: 'agent.paywall.body.subscriptionRequired',
  member: 'agent.paywall.body.member',
  salesManaged: 'agent.paywall.body.salesManaged',
  local: 'agent.paywall.body.local'
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
  <div
    class="flex w-full flex-col justify-center gap-2 overflow-hidden rounded-lg border border-component-node-border bg-modal-card-background p-4 shadow-sm"
  >
    <div class="flex w-full items-start gap-2">
      <span
        aria-hidden="true"
        class="mt-0.5 icon-[lucide--gauge] size-5 shrink-0 text-destructive-background"
      />
      <div class="min-w-0 flex-1 text-sm/5">
        <p class="m-0 font-medium text-base-foreground">
          {{ $t('agent.paywall.title') }}
        </p>
        <p class="m-0 text-muted-foreground">
          {{ $t(bodyKey) }}
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
  </div>
</template>
