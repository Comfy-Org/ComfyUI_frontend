<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

import type { PausedPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import { NO_FUNDS_PAUSE_REASON } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import type {
  AgentPaywallPresentation,
  AgentPaywallRemediation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import {
  DEFAULT_AGENT_PAYWALL_PRESENTATION,
  toAgentPaywallRemediation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const {
  part,
  presentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  answering = false
} = defineProps<{
  part: PausedPart
  presentation?: AgentPaywallPresentation
  answering?: boolean
}>()

const emit = defineEmits<{
  answer: [askId: string, selection: 'resume']
  paywallAction: [action: AgentPaywallRemediation]
}>()

const { t } = useI18n()

const REMEDIATION_LABELS: Record<AgentPaywallRemediation, string> = {
  addCredits: 'agent.paywall.addCredits',
  subscribe: 'agent.paywall.subscribe'
}

const outOfCredits = computed(() => part.reason === NO_FUNDS_PAUSE_REASON)

const remediation = computed(() =>
  outOfCredits.value ? toAgentPaywallRemediation(presentation) : undefined
)

const body = computed(() => part.message || part.prompt)
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
        :class="
          cn(
            'mt-0.5 size-5',
            outOfCredits
              ? 'icon-[lucide--gauge] text-destructive'
              : 'icon-[lucide--pause] text-muted-foreground'
          )
        "
      />
      <div class="min-w-0 flex-1 text-sm/5">
        <p class="m-0">
          {{
            t(outOfCredits ? 'agent.paused.titleNoFunds' : 'agent.paused.title')
          }}
        </p>
        <p class="m-0 wrap-break-word text-muted-foreground">
          {{ body }}
        </p>
        <p
          v-if="part.recheckAfterSeconds > 0"
          class="m-0 text-muted-foreground"
        >
          {{
            t(
              'agent.paused.recheck',
              { seconds: part.recheckAfterSeconds },
              part.recheckAfterSeconds
            )
          }}
        </p>
      </div>
    </div>

    <div class="flex w-full justify-end gap-2">
      <Button
        v-if="remediation"
        variant="inverted"
        size="sm"
        :disabled="answering"
        @click="emit('paywallAction', remediation)"
      >
        {{ t(REMEDIATION_LABELS[remediation]) }}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        :disabled="answering"
        :aria-busy="answering || undefined"
        @click="emit('answer', part.askId, 'resume')"
      >
        {{ t('agent.paused.resume') }}
      </Button>
    </div>
  </Card>
</template>
