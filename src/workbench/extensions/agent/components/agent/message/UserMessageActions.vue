<script setup lang="ts">
import { useClipboard, useClipboardItems } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'

import type { UserAttachment } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import type { SkillReference as SkillReferenceData } from '@/workbench/extensions/agent/types/skillReference'
import type {
  PromptSnapshot,
  WorkflowReference
} from '@/workbench/extensions/agent/types/workflowReference'

import { userMessageClipboard } from './userMessageClipboard'

const {
  text,
  readableText,
  attachments = [],
  tags = [],
  workflowReferences = [],
  skillReference,
  canEdit = false
} = defineProps<{
  text: string
  readableText: string
  attachments?: UserAttachment[]
  tags?: string[]
  workflowReferences?: WorkflowReference[]
  skillReference?: SkillReferenceData
  canEdit?: boolean
}>()

const emit = defineEmits<{
  edit: [prompt: PromptSnapshot]
}>()

const { t } = useI18n()
const plainClipboard = useClipboard({ copiedDuring: 2000, legacy: true })
const richClipboard = useClipboardItems({ copiedDuring: 2000 })
const copied = computed(
  () => plainClipboard.copied.value || richClipboard.copied.value
)

function onEdit(): void {
  emit('edit', {
    text,
    workflowReferences,
    ...(skillReference ? { skillReference } : {})
  })
}

async function copyMessage(): Promise<void> {
  if (
    (workflowReferences.length || skillReference) &&
    richClipboard.isSupported.value &&
    typeof ClipboardItem !== 'undefined'
  ) {
    const content = userMessageClipboard({
      text,
      workflowReferences,
      skillReference,
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
  await plainClipboard.copy(readableText)
}
</script>

<template>
  <div
    class="pointer-events-none flex text-muted-foreground opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 touch:pointer-events-auto touch:opacity-100"
  >
    <Button
      v-if="canEdit"
      :tooltip="t('g.edit')"
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('g.edit')"
      class="size-6 rounded-lg"
      @click="onEdit"
    >
      <i aria-hidden="true" class="icon-[lucide--pencil] size-3" />
    </Button>
    <Tooltip disable-closing-trigger>
      <TooltipTrigger as-child>
        <Button
          type="button"
          variant="muted-textonly"
          size="icon-sm"
          :aria-label="copied ? t('agent.copied') : t('agent.copy')"
          class="size-6 rounded-lg"
          @click="copyMessage"
        >
          <i
            aria-hidden="true"
            :class="
              cn(
                'size-3',
                copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
              )
            "
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{
        copied ? t('agent.copied') : t('agent.copy')
      }}</TooltipContent>
    </Tooltip>
  </div>
</template>
