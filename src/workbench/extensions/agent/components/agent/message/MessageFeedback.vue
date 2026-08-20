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
import { downloadReplyAsset } from '../../../utils/downloadReplyAsset'
import type { ReplyAsset } from '../../../utils/replyAssets'
import AgentTooltip from '../AgentTooltip.vue'

const { markdown, assets = [] } = defineProps<{
  markdown: string
  assets?: ReplyAsset[]
}>()
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

const downloading = ref(false)

async function downloadAssets(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    for (const asset of assets) {
      try {
        await downloadReplyAsset(asset)
      } catch {
        continue
      }
    }
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div class="text-agent-fg-muted flex w-full items-center justify-start gap-1">
    <AgentTooltip :label="t('agent.helpful')">
      <button
        type="button"
        :aria-label="t('agent.helpful')"
        :aria-pressed="vote === 'up'"
        :class="
          cn(
            'hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none',
            vote === 'up' ? 'text-agent-fg' : 'text-agent-fg-muted'
          )
        "
        @click="setVote('up')"
      >
        <span class="icon-[lucide--thumbs-up] size-3" />
      </button>
    </AgentTooltip>
    <AgentTooltip :label="t('agent.notHelpful')">
      <button
        type="button"
        :aria-label="t('agent.notHelpful')"
        :aria-pressed="vote === 'down'"
        :class="
          cn(
            'hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none',
            vote === 'down' ? 'text-agent-fg' : 'text-agent-fg-muted'
          )
        "
        @click="setVote('down')"
      >
        <span class="icon-[lucide--thumbs-down] size-3" />
      </button>
    </AgentTooltip>
    <AgentTooltip v-if="assets.length" :label="t('agent.downloadAssets')">
      <button
        type="button"
        :aria-label="t('agent.downloadAssets')"
        :disabled="downloading"
        class="hover:bg-agent-surface-hover hover:text-agent-fg focus-visible:ring-agent-accent text-agent-fg-muted flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
        @click="downloadAssets"
      >
        <span class="icon-[lucide--download] size-3" />
      </button>
    </AgentTooltip>
    <div
      class="hover:bg-agent-surface-hover hover:text-agent-fg has-[[data-state=open]]:bg-agent-surface-hover has-[[data-state=open]]:text-agent-fg flex h-6 w-14 rounded-lg transition-colors"
    >
      <AgentTooltip :label="copied ? t('agent.copied') : t('agent.copy')">
        <button
          type="button"
          :aria-label="copied ? t('agent.copied') : t('agent.copy')"
          :class="
            cn(
              'focus-visible:ring-agent-accent flex h-6 w-8 cursor-pointer items-center justify-center rounded-l-lg focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none',
              copied ? 'text-agent-fg' : 'text-inherit'
            )
          "
          @click="copyPlainText()"
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
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :aria-label="t('agent.copyMarkdown')"
          class="focus-visible:ring-agent-accent flex size-6 cursor-pointer items-center justify-center rounded-r-lg text-inherit focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
        >
          <span class="icon-[lucide--chevron-down] size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="end"
            :side-offset="4"
            class="bg-agent-surface-raised z-1100 h-9 w-36 rounded-[10px] border border-[rgba(10,10,10,0.1)] p-1 shadow-lg"
          >
            <DropdownMenuItem
              class="text-agent-fg data-highlighted:bg-agent-surface-hover flex h-7 w-full cursor-pointer items-center rounded-lg px-1.5 text-[14px]/5 font-normal whitespace-nowrap outline-none"
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
