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
  <div class="text-agent-fg-muted flex w-full items-center gap-1">
    <button
      type="button"
      :aria-label="t('agent.helpful')"
      :aria-pressed="vote === 'up'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex size-6 cursor-pointer items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
          vote === 'up' && 'text-agent-fg'
        )
      "
      @click="setVote('up')"
    >
      <span class="icon-[lucide--thumbs-up] size-4" />
    </button>
    <button
      type="button"
      :aria-label="t('agent.notHelpful')"
      :aria-pressed="vote === 'down'"
      :class="
        cn(
          'rounded-agent hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex size-6 cursor-pointer items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none',
          vote === 'down' && 'text-agent-fg'
        )
      "
      @click="setVote('down')"
    >
      <span class="icon-[lucide--thumbs-down] size-4" />
    </button>
    <div class="flex h-6 w-14">
      <button
        type="button"
        :aria-label="copied ? t('agent.copied') : t('agent.copy')"
        :class="
          cn(
            'rounded-l-agent hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex h-6 w-8 cursor-pointer items-center justify-center transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none',
            copied && 'text-agent-fg'
          )
        "
        @click="copyPlainText()"
      >
        <span
          :class="
            cn(
              'size-4',
              copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
            )
          "
        />
      </button>
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :aria-label="t('agent.copyMarkdown')"
          class="rounded-r-agent hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent data-[state=open]:bg-agent-surface-hover data-[state=open]:text-agent-fg flex size-6 cursor-pointer items-center justify-center transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span class="icon-[lucide--chevron-down] size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="start"
            :side-offset="4"
            class="rounded-agent bg-agent-surface-raised z-1100 h-9 w-36 -translate-x-8 p-1 shadow-lg"
          >
            <DropdownMenuItem
              class="text-agent-fg data-highlighted:bg-agent-surface-hover rounded-agent flex h-7 w-full cursor-pointer items-center px-2 text-xs whitespace-nowrap outline-none"
              @select="copy(markdown)"
            >
              {{ t('agent.copyMarkdown') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
  </div>
</template>
