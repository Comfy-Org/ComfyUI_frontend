<script setup lang="ts">
import Card from '@comfyorg/design-system/card/Card'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import type { PausedPart } from '@/workbench/extensions/agent/services/agent/agentMessageParts'
import type { AgentPaywallPresentation } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'

const {
  part,
  presentation,
  answering = false
} = defineProps<{
  part: PausedPart
  presentation?: AgentPaywallPresentation
  answering?: boolean
}>()

const emit = defineEmits<{
  answer: [askId: string, selection: 'resume']
  addCredits: [askId: string]
}>()

const { t } = useI18n()

/**
 * `no_funds` is the one pause reason the user themselves can clear, so it is
 * the one that gets credits framing and a top-up route. Every other reason
 * (`workspace_paused`, an operator pause, a reason this build does not know)
 * gets the neutral title: naming the wrong remediation is worse than naming
 * none, and a pause is recoverable either way.
 */
const outOfCredits = computed(() => part.reason === 'no_funds')

/**
 * Whether topping up is a route this workspace's viewer actually has. A member
 * who cannot pay, a sales-managed account and an unsettled billing read all
 * resolve to something other than a self-serve top-up, and the paywall
 * presentation already encodes that — so it is reused rather than re-derived
 * from a role here (FRONT-3626: low-credit copy differs by workspace).
 */
const canAddCredits = computed(
  () =>
    outOfCredits.value &&
    (presentation?.kind === 'subscribed' || presentation?.kind === 'local')
)

// The server owns this copy and already wrote it for the user; echoing its
// message keeps one source of truth for a string that varies by policy.
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
        class="mt-0.5 size-5"
        :class="
          outOfCredits
            ? 'icon-[lucide--gauge] text-destructive'
            : 'icon-[lucide--pause] text-muted-foreground'
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
          {{ t('agent.paused.recheck', { seconds: part.recheckAfterSeconds }) }}
        </p>
      </div>
    </div>

    <div class="flex w-full justify-end gap-2">
      <Button
        v-if="canAddCredits"
        variant="inverted"
        size="sm"
        :disabled="answering"
        @click="emit('addCredits', part.askId)"
      >
        {{ t('agent.paywall.addCredits') }}
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
