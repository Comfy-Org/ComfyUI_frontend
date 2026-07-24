<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

const { markdown } = defineProps<{ markdown: string }>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })

const vote = ref<'up' | 'down' | null>(null)

function setVote(next: 'up' | 'down'): void {
  vote.value = vote.value === next ? null : next
  emit('feedback', vote.value)
}

function copyPlainText(): void {
  const doc = new DOMParser().parseFromString(
    renderMarkdownToHtml(markdown),
    'text/html'
  )
  void copy(doc.body.textContent?.trim() ?? '')
}
</script>

<template>
  <div class="text-agent-fg-subtle flex items-center gap-0.5">
    <button
      type="button"
      :aria-label="t('agent.helpful')"
      :aria-pressed="vote === 'up'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors',
          vote === 'up' && 'text-agent-fg'
        )
      "
      @click="setVote('up')"
    >
      <span class="icon-[lucide--thumbs-up] size-3.5" />
    </button>
    <button
      type="button"
      :aria-label="t('agent.notHelpful')"
      :aria-pressed="vote === 'down'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors',
          vote === 'down' && 'text-agent-fg'
        )
      "
      @click="setVote('down')"
    >
      <span class="icon-[lucide--thumbs-down] size-3.5" />
    </button>
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        :aria-label="copied ? t('agent.copied') : t('agent.copy')"
        class="rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg flex size-6 items-center justify-center transition-colors"
      >
        <span
          :class="
            cn(
              'size-3.5',
              copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
            )
          "
        />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="start"
          :side-offset="4"
          class="rounded-agent border-agent-border bg-agent-surface-raised z-1100 border p-1 shadow-lg"
        >
          <DropdownMenuItem
            class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
            @select="copyPlainText()"
          >
            {{ t('agent.copy') }}
          </DropdownMenuItem>
          <DropdownMenuItem
            class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs outline-none"
            @select="copy(markdown)"
          >
            {{ t('agent.copyMarkdown') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
