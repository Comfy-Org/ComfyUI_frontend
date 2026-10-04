<script setup lang="ts">
import {
  useEventListener,
  useIntersectionObserver,
  useResizeObserver
} from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { buildTooltipConfig } from '@/composables/useTooltipConfig'

import { cn } from '@comfyorg/tailwind-utils'

import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type { ConversationEntry } from '../../stores/agent/agentConversationStore'
import type { AgentAnswerRequest, TurnId } from '../../schemas/agentApiSchema'
import type { PromptSnapshot } from '../../types/workflowReference'

import AgentMessage from './message/AgentMessage.vue'
import UserMessage from './message/UserMessage.vue'

const {
  entries,
  conversationId,
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  editableTurnId = null,
  answeringAskIds = new Set<string>()
} = defineProps<{
  entries: ConversationEntry[]
  conversationId?: string | null
  paywallPresentation?: AgentPaywallPresentation
  editableTurnId?: TurnId | null
  answeringAskIds?: ReadonlySet<string>
}>()
const emit = defineEmits<{
  feedback: [turnId: string, vote: 'up' | 'down' | null]
  editPrompt: [prompt: PromptSnapshot]
  answerAsk: [askId: string, answer: AgentAnswerRequest]
  openWorkflow: [askId: string, workflowId: string, workflowName?: string]
  approvalShown: [askId: string, turnId: string, workflowId: string | null]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  paywallAction: [action: AgentPaywallAction]
}>()

const { t } = useI18n()

const scrollContainer = ref<HTMLElement>()
const content = ref<HTMLElement>()
const shouldFollowLatest = ref(true)
const atBottom = ref(true)
const bottomGracePx = 16
const followIntentTolerancePx = 1
let pendingProgrammaticScroll: { target: number; frame: number } | undefined
let pendingConversationId: string | undefined

const top = ref<HTMLElement>()
const atTop = ref(true)

useIntersectionObserver(top, ([entry]) => {
  atTop.value = entry?.isIntersecting ?? true
})

function clearPendingProgrammaticScroll(): void {
  if (pendingProgrammaticScroll)
    cancelAnimationFrame(pendingProgrammaticScroll.frame)
  pendingProgrammaticScroll = undefined
}

useEventListener(scrollContainer, 'pointerdown', clearPendingProgrammaticScroll)
useEventListener(scrollContainer, 'keydown', clearPendingProgrammaticScroll)
useEventListener(scrollContainer, 'wheel', clearPendingProgrammaticScroll, {
  passive: true
})
useEventListener(
  scrollContainer,
  'touchstart',
  clearPendingProgrammaticScroll,
  {
    passive: true
  }
)

onBeforeUnmount(clearPendingProgrammaticScroll)

function scrollToLatest(): void {
  const element = scrollContainer.value
  if (!element) return
  shouldFollowLatest.value = true
  atBottom.value = true
  const target = Math.max(0, element.scrollHeight - element.clientHeight)
  clearPendingProgrammaticScroll()
  const willMove =
    element.scrollHeight > element.clientHeight &&
    Math.abs(element.scrollTop - target) > bottomGracePx
  if (willMove) {
    pendingProgrammaticScroll = {
      target,
      frame: requestAnimationFrame(clearPendingProgrammaticScroll)
    }
  }
  if (typeof element.scrollTo === 'function') {
    element.scrollTo({ top: target, behavior: 'instant' })
  } else {
    element.scrollTop = target
  }
}

useEventListener(scrollContainer, 'scroll', () => {
  const element = scrollContainer.value
  if (!element) return
  atBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    bottomGracePx
  if (
    pendingProgrammaticScroll &&
    Math.abs(element.scrollTop - pendingProgrammaticScroll.target) <=
      bottomGracePx
  ) {
    clearPendingProgrammaticScroll()
    return
  }
  shouldFollowLatest.value =
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    followIntentTolerancePx
  clearPendingProgrammaticScroll()
})

function followLatestAfterResize(): void {
  const element = scrollContainer.value
  if (!element || element.clientHeight === 0) return
  atBottom.value =
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    bottomGracePx
  if (shouldFollowLatest.value) scrollToLatest()
}

useResizeObserver(content, followLatestAfterResize)
useResizeObserver(scrollContainer, followLatestAfterResize)

const latestContentSignal = computed(() => {
  const last = entries.at(-1)
  if (!last || !('parts' in last)) return `${entries.length}`
  const tail = last.parts.at(-1)
  const tailText = tail && 'text' in tail ? tail.text.length : 0
  const settled = last.parts.filter(
    (part) => 'state' in part && part.state === 'done'
  ).length
  return `${entries.length}:${last.streaming}:${last.parts.length}:${settled}:${tailText}`
})

watch(
  () => conversationId,
  (current, previous) => {
    if (current == null || previous == null) return
    pendingConversationId = current
    shouldFollowLatest.value = true
  }
)

watch(
  () => entries,
  async () => {
    if (entries.length === 0) {
      pendingConversationId = undefined
      shouldFollowLatest.value = true
      return
    }
    if (
      pendingConversationId === undefined ||
      pendingConversationId !== conversationId
    )
      return
    pendingConversationId = undefined
    shouldFollowLatest.value = true
    await nextTick()
    scrollToLatest()
  }
)

watch(
  latestContentSignal,
  async () => {
    if (!shouldFollowLatest.value) return
    await nextTick()
    if (!shouldFollowLatest.value) return
    scrollToLatest()
  },
  { flush: 'post', immediate: true }
)
</script>

<template>
  <div data-testid="agent-conversation" class="relative h-full">
    <div
      ref="scrollContainer"
      data-testid="agent-conversation-scroll"
      :class="
        cn(
          'h-full overflow-y-auto',
          !atTop && 'mask-t-from-[calc(100%-2rem)]',
          !atBottom && 'mask-b-from-[calc(100%-2rem)]'
        )
      "
    >
      <div ref="top" />
      <div ref="content" class="mx-auto max-w-[640px] p-4">
        <div class="flex flex-col gap-4">
          <template v-for="entry in entries" :key="`${entry.role}-${entry.id}`">
            <UserMessage
              v-if="entry.role === 'user'"
              :text="entry.text"
              :attachments="entry.attachments"
              :tags="entry.tags"
              :workflow-references="entry.workflowReferences"
              :editable="entry.id === editableTurnId"
              @edit="emit('editPrompt', $event)"
              @open-reference-workflow="
                (workflowId: string, workflowName: string) =>
                  emit('openReferenceWorkflow', workflowId, workflowName)
              "
            />
            <AgentMessage
              v-else
              :message="entry"
              :answering-ask-ids
              :paywall-presentation
              @feedback="emit('feedback', entry.id, $event)"
              @answer-ask="
                (askId: string, answer: AgentAnswerRequest) =>
                  emit('answerAsk', askId, answer)
              "
              @approval-shown="
                (askId, turnId, workflowId) =>
                  emit('approvalShown', askId, turnId, workflowId)
              "
              @open-workflow="
                (askId: string, workflowId: string, workflowName?: string) =>
                  emit('openWorkflow', askId, workflowId, workflowName)
              "
              @paywall-action="emit('paywallAction', $event)"
            />
          </template>
        </div>
      </div>
    </div>

    <Button
      v-if="!shouldFollowLatest"
      v-tooltip.top="buildTooltipConfig(t('agent.latest'))"
      type="button"
      variant="secondary"
      size="icon"
      :aria-label="t('agent.latest')"
      class="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full shadow-md ring-1 ring-muted-foreground"
      @click="scrollToLatest"
    >
      <span class="icon-[lucide--chevron-down] size-4" />
    </Button>
  </div>
</template>
