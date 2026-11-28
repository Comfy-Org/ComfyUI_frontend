<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

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
const { copied, copyToClipboard } = useCopyToClipboard({
  copiedDuring: 2000,
  showSuccessToast: false
})

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
    typeof ClipboardItem !== 'undefined'
  ) {
    const content = userMessageClipboard({
      text,
      workflowReferences,
      skillReference,
      tags,
      attachments
    })
    await copyToClipboard(content.text, {
      clipboardItems: [
        new ClipboardItem({
          'text/plain': new Blob([content.text], { type: 'text/plain' }),
          'text/html': new Blob([content.html], { type: 'text/html' })
        })
      ]
    })
    return
  }
  await copyToClipboard(readableText)
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
