<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import type { UserAttachment } from '../../../stores/agent/agentConversationStore'

const {
  text,
  attachments = [],
  tags = []
} = defineProps<{
  text: string
  attachments?: UserAttachment[]
  tags?: string[]
}>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
</script>

<template>
  <div class="group mb-8 flex flex-col items-end gap-1.5 not-first:mt-5">
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
      class="bg-agent-surface-raised text-agent-fg w-fit max-w-full rounded-lg px-3 py-1.5 text-sm whitespace-pre-wrap"
    >
      {{ text }}
    </div>
    <div
      v-if="text"
      class="text-agent-fg-subtle flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
    >
      <button
        type="button"
        :aria-label="copied ? t('agent.copied') : t('agent.copy')"
        class="rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 cursor-pointer items-center justify-center transition-colors"
        @click="copy(text)"
      >
        <span
          :class="
            cn(
              'size-3.5',
              copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
            )
          "
        />
      </button>
    </div>
  </div>
</template>
