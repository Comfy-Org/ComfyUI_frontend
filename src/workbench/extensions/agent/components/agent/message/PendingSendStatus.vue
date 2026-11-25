<script setup lang="ts">
import type { AgentPaywallSurface } from '@comfyorg/telemetry/types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@comfyorg/design-system/button/Button'

import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  PendingSendEntryState,
  PendingSendFailure
} from '@/workbench/extensions/agent/stores/agent/agentConversationStore'

import AgentPaywallCard from './AgentPaywallCard.vue'

const {
  pending,
  failure,
  justFailed = false,
  retryDisabled = false,
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION
} = defineProps<{
  pending: PendingSendEntryState
  failure: PendingSendFailure
  justFailed?: boolean
  retryDisabled?: boolean
  paywallPresentation?: AgentPaywallPresentation
}>()

const emit = defineEmits<{
  retryPending: [clientMessageId: string]
  deletePending: [clientMessageId: string]
  newChat: []
  paywallAction: [action: AgentPaywallAction, surface: AgentPaywallSurface]
}>()

const { t } = useI18n()

const alertRole = computed(() => (justFailed ? 'alert' : 'status'))

const retryLocked = ref(false)
let retryTimer: ReturnType<typeof setTimeout> | undefined

function clearRetryTimer(): void {
  if (retryTimer !== undefined) {
    clearTimeout(retryTimer)
    retryTimer = undefined
  }
}

function retryRemainingMs(current: PendingSendFailure): number {
  if (current.kind !== 'retry_after') return 0
  if (current.retryAtMs !== undefined)
    return Math.max(0, current.retryAtMs - Date.now())
  if (current.retryAfterSeconds !== undefined)
    return Math.max(0, current.retryAfterSeconds * 1000)
  return 0
}

watch(
  () => [pending.status, failure] as const,
  ([status, current]) => {
    clearRetryTimer()
    const remainingMs = status === 'failed' ? retryRemainingMs(current) : 0
    retryLocked.value = remainingMs > 0
    if (remainingMs > 0) {
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        retryLocked.value = false
      }, remainingMs)
    }
  },
  { immediate: true }
)

onBeforeUnmount(clearRetryTimer)

const actionKind = computed<'new_chat' | 'retry' | 'none'>(() => {
  if (failure.kind === 'disowned' || failure.kind === 'target_unavailable')
    return 'new_chat'
  return failure.retryable === false ? 'none' : 'retry'
})

const showPaywallCard = computed(
  () => failure.kind === 'paywall' && !pending.paywallResolved
)

const failedStatusText = computed(() => {
  if (failure.kind === 'paywall') return t('agent.sendFailed')
  if (
    failure.kind === 'retry_after' &&
    retryLocked.value &&
    failure.retryAfterSeconds !== undefined
  )
    return `${failure.message} ${t('agent.retryAfterSeconds', { seconds: failure.retryAfterSeconds })}`
  return failure.message
})
</script>

<template>
  <div class="flex w-full flex-col items-end gap-2">
    <div
      :role="alertRole"
      data-testid="pending-send-error"
      class="flex items-center justify-end gap-1.5 text-xs text-destructive"
    >
      <i aria-hidden="true" class="icon-[lucide--circle-alert] size-3.5" />
      <span>{{ failedStatusText }}</span>
    </div>
    <div class="flex items-center justify-end gap-1.5">
      <Button
        v-if="actionKind === 'new_chat'"
        type="button"
        variant="secondary"
        size="sm"
        @click="emit('newChat')"
      >
        {{ t('agent.newChat') }}
      </Button>
      <Button
        v-else-if="actionKind === 'retry'"
        type="button"
        variant="secondary"
        size="sm"
        :disabled="retryLocked || retryDisabled"
        @click="emit('retryPending', pending.clientMessageId)"
      >
        {{ t('g.retry') }}
      </Button>
      <Button
        type="button"
        variant="muted-textonly"
        size="sm"
        @click="emit('deletePending', pending.clientMessageId)"
      >
        {{ t('g.delete') }}
      </Button>
    </div>
    <AgentPaywallCard
      v-if="showPaywallCard"
      :presentation="paywallPresentation"
      :message="failure.message"
      @paywall-action="emit('paywallAction', $event, 'refused_send')"
    />
  </div>
</template>
