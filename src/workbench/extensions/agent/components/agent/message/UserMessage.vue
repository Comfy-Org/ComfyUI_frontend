<script setup lang="ts">
import type { AgentPaywallSurface } from '@comfyorg/telemetry/types'
import { computed, ref, useTemplateRef, watch } from 'vue'

import Tag from '@comfyorg/design-system/chip/Tag'

import type {
  PendingSendEntryState,
  UserAttachment
} from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type {
  PromptSnapshot,
  WorkflowReference
} from '@/workbench/extensions/agent/types/workflowReference'
import { agentMessageText } from '@/workbench/extensions/agent/utils/agentMessageText'
import { promptReferenceParts } from '@/workbench/extensions/agent/utils/promptReferenceParts'
import type { SkillReference as SkillReferenceData } from '@/workbench/extensions/agent/types/skillReference'
import { DEFAULT_AGENT_PAYWALL_PRESENTATION } from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import type {
  AgentPaywallAction,
  AgentPaywallPresentation
} from '@/workbench/extensions/agent/services/agent/agentPaywallPresentation'
import PendingSendStatus from './PendingSendStatus.vue'
import UserMessageActions from './UserMessageActions.vue'
import UserMessageAttachments from './UserMessageAttachments.vue'
import UserMessagePromptParts from './UserMessagePromptParts.vue'
import { selectedUserMessageClipboard } from './userMessageClipboard'

const {
  text,
  attachments = [],
  tags = [],
  workflowReferences = [],
  skillReference,
  pending,
  retryDisabled = false,
  paywallPresentation = DEFAULT_AGENT_PAYWALL_PRESENTATION,
  editable = false
} = defineProps<{
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReferenceData
  pending?: PendingSendEntryState
  retryDisabled?: boolean
  paywallPresentation?: AgentPaywallPresentation
  editable?: boolean
}>()
const emit = defineEmits<{
  edit: [prompt: PromptSnapshot]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
  retryPending: [clientMessageId: string]
  deletePending: [clientMessageId: string]
  newChat: []
  paywallAction: [action: AgentPaywallAction, surface: AgentPaywallSurface]
}>()

const justFailed = ref(false)
watch(
  () => pending?.status,
  (current, previous) => {
    if (previous === 'sending' && current === 'failed') justFailed.value = true
    else if (current !== 'failed') justFailed.value = false
  }
)
const isSending = computed(() => pending?.status === 'sending')
const failedPending = computed(() =>
  pending?.status === 'failed' && pending.failure
    ? { pending, failure: pending.failure }
    : null
)
const hasBubbleContent = computed(() =>
  Boolean(text || workflowReferences.length || skillReference)
)
const showBubbleRow = computed(() => hasBubbleContent.value || isSending.value)
const canEdit = computed(() => editable && hasBubbleContent.value)

function forwardPaywallAction(
  action: AgentPaywallAction,
  surface: AgentPaywallSurface
): void {
  emit('paywallAction', action, surface)
}
const promptParts = computed(() =>
  promptReferenceParts(text, workflowReferences, skillReference)
)
const readableText = computed(() =>
  agentMessageText({
    text,
    workflowReferences,
    skillReference,
    tags,
    attachments
  })
)
const bubble = useTemplateRef<HTMLElement>('bubble')

function copySelection(event: ClipboardEvent): void {
  if (!bubble.value || !event.clipboardData) return
  const content = selectedUserMessageClipboard(
    bubble.value,
    document.getSelection()
  )
  if (!content) return
  event.clipboardData.setData('text/plain', content.text)
  event.clipboardData.setData('text/html', content.html)
  event.preventDefault()
  event.stopPropagation()
}

function forwardOpenReference(workflowId: string, workflowName: string): void {
  emit('openReferenceWorkflow', workflowId, workflowName)
}
</script>

<template>
  <div class="group flex flex-col items-end gap-2 pl-16" @copy="copySelection">
    <div v-if="tags.length" class="flex flex-wrap justify-end gap-1">
      <Tag
        v-for="(tag, index) in tags"
        :key="`${tag}:${index}`"
        :label="tag"
        shape="rounded"
        class="max-w-48"
      >
        <template #icon>
          <i aria-hidden="true" class="icon-[lucide--at-sign] size-3" />
        </template>
      </Tag>
    </div>
    <UserMessageAttachments v-if="attachments.length" :attachments />
    <div
      v-if="showBubbleRow"
      class="flex max-w-full items-center justify-end gap-1.5"
    >
      <div
        v-if="isSending"
        aria-hidden="true"
        data-testid="pending-send-spinner"
        class="flex shrink-0 items-center text-muted-foreground"
      >
        <i
          aria-hidden="true"
          class="icon-[lucide--loader-circle] size-3.5 motion-safe:animate-spin"
        />
      </div>
      <div
        v-if="hasBubbleContent"
        ref="bubble"
        data-testid="user-message-bubble"
        class="w-fit max-w-full rounded-lg bg-secondary px-2.5 py-1.5 text-sm/5 font-normal wrap-break-word whitespace-pre-wrap text-muted-foreground"
      >
        <UserMessagePromptParts
          :parts="promptParts"
          @open-reference-workflow="forwardOpenReference"
        />
      </div>
    </div>
    <PendingSendStatus
      v-if="failedPending"
      :pending="failedPending.pending"
      :failure="failedPending.failure"
      :just-failed="justFailed"
      :retry-disabled="retryDisabled"
      :paywall-presentation="paywallPresentation"
      @retry-pending="emit('retryPending', $event)"
      @delete-pending="emit('deletePending', $event)"
      @new-chat="emit('newChat')"
      @paywall-action="forwardPaywallAction"
    />
    <UserMessageActions
      v-if="readableText"
      :text
      :readable-text
      :attachments
      :tags
      :workflow-references
      :skill-reference
      :can-edit
      @edit="emit('edit', $event)"
    />
  </div>
</template>
