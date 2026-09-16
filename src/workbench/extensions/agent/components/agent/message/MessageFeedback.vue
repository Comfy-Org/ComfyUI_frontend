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
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { downloadReplyAsset } from '../../../utils/downloadReplyAsset'
import type { ReplyAsset } from '../../../utils/replyAssets'

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
  <div
    class="flex w-full items-center justify-start gap-1 text-muted-foreground"
  >
    <AccessibleTooltip
      :label="t('agent.helpful')"
      :skip-delay-duration="0"
      disable-hoverable-content
      :collision-padding="8"
    >
      <template #trigger>
        <button
          type="button"
          :aria-label="t('agent.helpful')"
          :aria-pressed="vote === 'up'"
          :class="
            cn(
              'flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none',
              vote === 'up' ? 'text-base-foreground' : 'text-muted-foreground'
            )
          "
          @click="setVote('up')"
        >
          <span class="icon-[lucide--thumbs-up] size-3" />
        </button>
      </template>
    </AccessibleTooltip>
    <AccessibleTooltip
      :label="t('agent.notHelpful')"
      :skip-delay-duration="0"
      disable-hoverable-content
      :collision-padding="8"
    >
      <template #trigger>
        <button
          type="button"
          :aria-label="t('agent.notHelpful')"
          :aria-pressed="vote === 'down'"
          :class="
            cn(
              'flex size-6 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none',
              vote === 'down' ? 'text-base-foreground' : 'text-muted-foreground'
            )
          "
          @click="setVote('down')"
        >
          <span class="icon-[lucide--thumbs-down] size-3" />
        </button>
      </template>
    </AccessibleTooltip>
    <AccessibleTooltip
      v-if="assets.length"
      :label="t('agent.downloadAssets')"
      :skip-delay-duration="0"
      disable-hoverable-content
      :collision-padding="8"
    >
      <template #trigger>
        <button
          type="button"
          :aria-label="t('agent.downloadAssets')"
          :disabled="downloading"
          class="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary-background-hover hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
          @click="downloadAssets"
        >
          <span class="icon-[lucide--download] size-3" />
        </button>
      </template>
    </AccessibleTooltip>
    <div
      class="flex h-6 w-14 rounded-lg transition-colors hover:bg-secondary-background-hover hover:text-base-foreground has-data-[state=open]:bg-secondary-background-hover has-data-[state=open]:text-base-foreground"
    >
      <AccessibleTooltip
        :label="copied ? t('agent.copied') : t('agent.copy')"
        :skip-delay-duration="0"
        disable-hoverable-content
        :collision-padding="8"
      >
        <template #trigger>
          <button
            type="button"
            :aria-label="copied ? t('agent.copied') : t('agent.copy')"
            :class="
              cn(
                'flex h-6 w-8 cursor-pointer items-center justify-center rounded-l-lg focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none',
                copied ? 'text-base-foreground' : 'text-inherit'
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
        </template>
      </AccessibleTooltip>
      <DropdownMenuRoot>
        <DropdownMenuTrigger
          :aria-label="t('agent.copyMarkdown')"
          class="flex size-6 cursor-pointer items-center justify-center rounded-r-lg text-inherit focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary-background focus-visible:outline-none"
        >
          <span class="icon-[lucide--chevron-down] size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            align="end"
            :side-offset="4"
            class="z-1100 h-9 w-36 rounded-lg border border-border-subtle bg-secondary-background p-1 shadow-lg"
          >
            <DropdownMenuItem
              class="flex h-7 w-full cursor-pointer items-center rounded-lg px-1.5 text-[14px]/5 font-normal whitespace-nowrap text-base-foreground outline-none data-highlighted:bg-secondary-background-hover"
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
