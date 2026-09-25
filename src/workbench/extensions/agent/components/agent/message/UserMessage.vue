<script setup lang="ts">
import { useClipboard, useClipboardItems } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
import Tag from '@/components/chip/Tag.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { api } from '@/scripts/api'
import type { MediaType } from '@/utils/formatUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { UserAttachment } from '../../../stores/agent/agentConversationStore'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../../../types/workflowReference'
import type { ReplyAsset } from '../../../utils/replyAssets'
import { agentMessageText } from '../../../utils/agentMessageText'
import { workflowReferenceParts } from '../../../utils/workflowReferenceParts'
import ReplyAssetGroup from './ReplyAssetGroup.vue'
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

/* The shared map's 'other' glyph is a checkmark, which reads as a status
   rather than a file on this surface. */
function attachmentIconClass(name: string): string {
  const kind = getMediaTypeFromFilename(name)
  return kind === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind)
}

/**
 * Sent uploads reuse the reply asset grid (Uy, FE-1323): media attachments
 * render as the DES-530 per-count grid with the same hover-play, inspect, and
 * audio-card behavior as agent replies. A ref resolves to the uploaded input
 * file; an image without one still has its local preview. Text and other
 * kinds have no grid treatment and keep the compact tiles.
 *
 * A rehydrated attachment carries the kind the server resolved from the
 * asset's MIME type, which outranks the one guessed from the name: a library
 * asset is attached under its content hash, and a hash has no extension to
 * read a kind off. That column holds whatever the uploading client declared,
 * so a mis-declared type now outranks a correct extension -- the same
 * mime-before-name order the service itself applies.
 */
const GRID_KINDS = new Set<MediaType>(['image', 'video', 'audio', '3D'])

function attachmentUrl(item: UserAttachment): string | undefined {
  if (item.previewUrl !== undefined) return item.previewUrl
  if (!item.ref) return undefined
  return api.apiURL(`/view?filename=${encodeURIComponent(item.ref)}&type=input`)
}

function gridAsset(item: UserAttachment): ReplyAsset | undefined {
  const kind = item.kind ?? getMediaTypeFromFilename(item.name)
  const url = attachmentUrl(item)
  if (!url || !GRID_KINDS.has(kind)) return undefined
  return { url, filename: item.name, kind: kind as ReplyAsset['kind'] }
}

const splitAttachments = computed(() => {
  const grid: ReplyAsset[] = []
  const plain: UserAttachment[] = []
  for (const item of attachments) {
    const asset = gridAsset(item)
    if (asset) grid.push(asset)
    else plain.push(item)
  }
  return { grid, plain }
})
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
          <span class="icon-[lucide--at-sign] size-3 shrink-0" />
        </template>
      </Tag>
    </div>
    <div v-if="splitAttachments.grid.length" class="w-full">
      <ReplyAssetGroup :assets="splitAttachments.grid" />
    </div>
    <div
      v-if="splitAttachments.plain.length"
      class="grid w-56 max-w-full grid-cols-2 gap-1.5"
    >
      <figure
        v-for="(item, index) in splitAttachments.plain"
        :key="`${item.name}:${index}`"
        class="m-0"
      >
        <div
          class="flex aspect-square w-full items-center justify-center rounded-lg bg-secondary-background"
        >
          <span
            :class="
              cn(attachmentIconClass(item.name), 'size-6 text-muted-foreground')
            "
          />
        </div>
        <figcaption class="mt-0.5 truncate text-xs text-muted-foreground">
          {{ item.name }}
        </figcaption>
      </figure>
    </div>
    <div
      v-if="text || workflowReferences.length"
      ref="bubble"
      data-testid="user-message-bubble"
      class="w-fit max-w-full rounded-lg border border-component-node-border bg-secondary-background px-2.5 py-1.5 text-sm/7 font-normal wrap-break-word whitespace-pre-wrap text-muted-foreground"
    >
      <template v-for="(part, index) in promptParts" :key="index">
        <Tag
          v-if="part.type === 'workflow'"
          interactive
          :label="part.reference.name"
          class="max-w-64 align-middle"
          :aria-label="
            part.reference.unavailable
              ? t('agent.unavailableWorkflowReference', {
                  name: part.reference.name
                })
              : t('agent.openWorkflowTab', { name: part.reference.name })
          "
          data-testid="workflow-reference-chip"
          data-comfy-workflow="1"
          :data-workflow-id="part.reference.id"
          :data-workflow-unavailable="
            part.reference.unavailable ? 'true' : undefined
          "
          :aria-disabled="part.reference.unavailable"
          :aria-description="
            part.reference.unavailable
              ? t('agent.workflowReferenceUnavailableReason')
              : undefined
          "
          :title="
            part.reference.unavailable
              ? t('agent.workflowReferenceUnavailableReason')
              : undefined
          "
          @click="openReference(part.reference)"
        >
          <template #icon>
            <span class="icon-[comfy--workflow] size-3 shrink-0" />
          </template>
        </Tag>
        <template v-else>{{ part.text }}</template>
      </template>
    </div>
    <div
      v-if="readableText"
      class="flex text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 touch:opacity-100"
    >
      <AccessibleTooltip
        v-if="editable && (text || workflowReferences.length)"
        :label="t('g.edit')"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
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
        </template>
      </AccessibleTooltip>
      <AccessibleTooltip
        :label="copied ? t('agent.copied') : t('agent.copy')"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
          <Button
            type="button"
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="copied ? t('agent.copied') : t('agent.copy')"
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
        </template>
      </AccessibleTooltip>
    </div>
  </div>
</template>
