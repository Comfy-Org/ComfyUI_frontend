<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { api } from '@/scripts/api'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { UserAttachment } from '../../../stores/agent/agentConversationStore'
import type {
  PromptSnapshot,
  WorkflowReference
} from '../../../types/workflowReference'
import type { ReplyAsset } from '../../../utils/replyAssets'
import { workflowReferenceParts } from '../../../utils/workflowReferenceParts'
import AgentTooltip from '../AgentTooltip.vue'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

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
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

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
 */
const splitAttachments = computed(() => {
  const grid: ReplyAsset[] = []
  const plain: UserAttachment[] = []
  for (const item of attachments) {
    const kind = getMediaTypeFromFilename(item.name)
    const url = item.ref
      ? api.apiURL(`/view?filename=${encodeURIComponent(item.ref)}&type=input`)
      : item.previewUrl
    if (
      url &&
      (kind === 'image' ||
        kind === 'video' ||
        kind === 'audio' ||
        kind === '3D')
    ) {
      grid.push({ url, filename: item.name, kind })
    } else {
      plain.push(item)
    }
  }
  return { grid, plain }
})
</script>

<template>
  <div class="group flex flex-col items-end gap-2 pl-16">
    <div v-if="tags.length" class="flex flex-wrap justify-end gap-1">
      <span
        v-for="(tag, index) in tags"
        :key="`${tag}:${index}`"
        class="rounded-agent bg-agent-pill text-agent-fg-muted inline-flex items-center gap-1 px-1.5 py-0.5 text-xs"
      >
        <span class="icon-[lucide--at-sign] size-3 shrink-0" />
        <span class="max-w-40 truncate">{{ tag }}</span>
      </span>
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
          class="bg-agent-surface-raised flex aspect-square w-full items-center justify-center rounded-lg"
        >
          <span
            :class="
              cn(attachmentIconClass(item.name), 'text-agent-fg-subtle size-6')
            "
          />
        </div>
        <figcaption class="text-agent-fg-muted mt-0.5 truncate text-xs">
          {{ item.name }}
        </figcaption>
      </figure>
    </div>
    <div
      v-if="text || workflowReferences.length"
      data-testid="user-message-bubble"
      class="border-agent-border bg-agent-surface-raised text-agent-fg-muted w-fit max-w-full rounded-[10px] border px-2.5 py-1.5 text-sm/5 font-normal wrap-break-word whitespace-pre-wrap"
    >
      <template v-for="(part, index) in promptParts" :key="index">
        <span
          v-if="part.type === 'workflow'"
          role="button"
          tabindex="0"
          :aria-label="
            part.reference.unavailable
              ? t('agent.unavailableWorkflowReference', {
                  name: part.reference.name
                })
              : t('agent.openWorkflowTab', { name: part.reference.name })
          "
          data-testid="workflow-reference-chip"
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
          class="inline cursor-pointer rounded-sm bg-primary-background/30 box-decoration-clone px-1 py-0.5 font-inter text-xs/[15px] font-normal break-all whitespace-normal text-primary-background-hover ring-1 ring-primary-background/30 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-background aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          @click="openReference(part.reference)"
          @keydown.enter.prevent="openReference(part.reference)"
          @keydown.space.prevent
          @keyup.space.prevent="openReference(part.reference)"
        >
          <span
            class="mr-1 icon-[comfy--workflow] inline-block size-3 align-middle"
          />
          <span>{{ part.reference.name }}</span>
        </span>
        <template v-else>{{ part.text }}</template>
      </template>
    </div>
    <div
      v-if="text"
      class="text-agent-fg-subtle flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 touch:opacity-100"
    >
      <AgentTooltip v-if="editable" :label="t('g.edit')">
        <button
          type="button"
          :aria-label="t('g.edit')"
          class="hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 cursor-pointer items-center justify-center rounded-lg p-1 transition-colors"
          @click="emit('edit', { text, workflowReferences })"
        >
          <span class="icon-[lucide--pencil] size-3" />
        </button>
      </AgentTooltip>
      <AgentTooltip :label="copied ? t('agent.copied') : t('agent.copy')">
        <button
          type="button"
          :aria-label="copied ? t('agent.copied') : t('agent.copy')"
          class="hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 cursor-pointer items-center justify-center rounded-lg p-1 transition-colors"
          @click="copy(text)"
        >
          <span
            :class="
              cn(
                'size-3',
                copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
              )
            "
          />
        </button>
      </AgentTooltip>
    </div>
  </div>
</template>
