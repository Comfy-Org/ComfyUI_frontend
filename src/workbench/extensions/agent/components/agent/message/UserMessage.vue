<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import type { UserAttachment } from '../../../stores/agent/agentConversationStore'
import AgentTooltip from '../AgentTooltip.vue'

const {
  text,
  attachments = [],
  tags = [],
  editable = false
} = defineProps<{
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
  editable?: boolean
}>()
const emit = defineEmits<{
  edit: [text: string]
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
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
    <div
      v-if="attachments.length"
      class="grid w-56 max-w-full grid-cols-2 gap-1.5"
    >
      <figure
        v-for="(item, index) in attachments"
        :key="`${item.name}:${index}`"
        class="m-0"
      >
        <img
          v-if="item.previewUrl"
          :src="item.previewUrl"
          :alt="item.name"
          class="aspect-square w-full rounded-lg object-cover"
        />
        <div
          v-else
          class="bg-agent-surface-raised flex aspect-square w-full items-center justify-center rounded-lg"
        >
          <span class="text-agent-fg-subtle icon-[lucide--image] size-6" />
        </div>
        <figcaption class="text-agent-fg-muted mt-0.5 truncate text-xs">
          {{ item.name }}
        </figcaption>
      </figure>
    </div>
    <div
      v-if="text"
      class="border-agent-border bg-agent-surface-raised text-agent-fg w-fit max-w-full rounded-[10px] border px-2.5 py-1.5 text-sm wrap-break-word whitespace-pre-wrap"
    >
      {{ text }}
    </div>
    <div
      v-if="text"
      class="text-agent-fg-subtle pointer-events-none flex opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 touch:pointer-events-auto touch:opacity-100"
    >
      <AgentTooltip v-if="editable" :label="t('g.edit')">
        <button
          type="button"
          :aria-label="t('g.edit')"
          class="hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 cursor-pointer items-center justify-center rounded-lg p-1 transition-colors"
          @click="emit('edit', text)"
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
