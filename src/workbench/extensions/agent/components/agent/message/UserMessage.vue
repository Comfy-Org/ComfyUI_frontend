<script setup lang="ts">
import { useClipboard, useClipboardItems } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'

import type { UserAttachment } from '../../../stores/agent/agentConversationStore'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../../../types/workflowReference'
import { agentMessageText } from '../../../utils/agentMessageText'
import { workflowReferenceParts } from '../../../utils/workflowReferenceParts'
import UserMessageAttachments from './UserMessageAttachments.vue'
import WorkflowReferenceChip from './WorkflowReferenceChip.vue'
import {
  selectedUserMessageClipboard,
  userMessageClipboard
} from './userMessageClipboard'

const {
  text,
  attachments = [],
  tags = [],
  workflowReferences = [],
  editable = false
} = defineProps<{
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  editable?: boolean
}>()
const emit = defineEmits<{
  edit: [prompt: PromptSnapshot]
  openReferenceWorkflow: [workflowId: string, workflowName: string]
}>()

const { t } = useI18n()
const hasPrompt = computed(() => Boolean(text || workflowReferences.length))
const canEdit = computed(() => editable && hasPrompt.value)
const promptParts = computed(() =>
  workflowReferenceParts(text, workflowReferences)
)
const readableText = computed(() =>
  agentMessageText({ text, workflowReferences, tags, attachments })
)
const bubble = useTemplateRef<HTMLElement>('bubble')
const plainClipboard = useClipboard({ copiedDuring: 2000, legacy: true })
const richClipboard = useClipboardItems({ copiedDuring: 2000 })
const copied = computed(
  () => plainClipboard.copied.value || richClipboard.copied.value
)
const copyLabel = computed(() =>
  copied.value ? t('agent.copied') : t('agent.copy')
)

async function copyMessage(): Promise<void> {
  if (
    workflowReferences.length &&
    richClipboard.isSupported.value &&
    typeof ClipboardItem !== 'undefined'
  ) {
    const content = userMessageClipboard({
      text,
      workflowReferences,
      tags,
      attachments
    })
    try {
      await richClipboard.copy([
        new ClipboardItem({
          'text/plain': new Blob([content.text], { type: 'text/plain' }),
          'text/html': new Blob([content.html], { type: 'text/html' })
        })
      ])
      return
    } catch {
      await plainClipboard.copy(content.text)
      return
    }
  }
  await plainClipboard.copy(readableText.value)
}

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

function openReference(reference: WorkflowReference): void {
  if (reference.unavailable) return
  emit('openReferenceWorkflow', reference.id, reference.name)
}
</script>

<template>
  <div class="group flex flex-col items-end gap-2 pl-16" @copy="copySelection">
    <UserMessageAttachments :attachments :tags />
    <div
      v-if="hasPrompt"
      ref="bubble"
      data-testid="user-message-bubble"
      class="w-fit max-w-full rounded-lg border border-component-node-border bg-secondary-background px-2.5 py-1.5 text-sm/7 font-normal wrap-break-word whitespace-pre-wrap text-muted-foreground"
    >
      <template v-for="(part, index) in promptParts" :key="index">
        <WorkflowReferenceChip
          v-if="part.type === 'workflow'"
          :reference="part.reference"
          @open="openReference"
        />
        <template v-else>{{ part.text }}</template>
      </template>
    </div>
    <div
      v-if="readableText"
      class="flex text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 touch:opacity-100"
    >
      <Tooltip
        v-if="canEdit"
        :config="t('g.edit')"
        side="top"
        :delay-duration="300"
        :ignore-non-keyboard-focus="false"
        disable-closing-trigger
        :collision-padding="8"
      >
        <Button
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="t('g.edit')"
          class="size-6 rounded-lg"
          @click="emit('edit', { text, workflowReferences })"
        >
          <span class="icon-[lucide--pencil] size-3" />
        </Button>
      </Tooltip>
      <Tooltip
        :config="copyLabel"
        side="top"
        :delay-duration="300"
        :ignore-non-keyboard-focus="false"
        disable-closing-trigger
        :collision-padding="8"
      >
        <Button
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="copyLabel"
          class="size-6 rounded-lg"
          @click="copyMessage"
        >
          <span
            :class="
              cn(
                'size-3',
                copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
              )
            "
          />
        </Button>
      </Tooltip>
    </div>
  </div>
</template>
