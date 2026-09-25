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
import Button from '@/components/ui/button/Button.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import { useAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { resolveReplyAssetDownload } from '../../../utils/resolveReplyAssetDownload'
import type { ReplyAsset } from '../../../utils/replyAssets'

const { markdown, assets = [] } = defineProps<{
  markdown: string
  assets?: ReplyAsset[]
}>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ copiedDuring: 2000, legacy: true })
const { downloadFiles } = useAssetDownload()

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
    await downloadFiles(
      await Promise.all(assets.map(resolveReplyAssetDownload))
    )
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div
    class="flex w-full items-center justify-start gap-1 text-muted-foreground"
  >
    <Tooltip
      :config="t('agent.helpful')"
      side="top"
      :delay-duration="300"
      :ignore-non-keyboard-focus="false"
      disable-closing-trigger
      :collision-padding="8"
    >
      <Button
        type="button"
        :variant="vote === 'up' ? 'textonly' : 'muted-textonly'"
        size="icon-sm"
        :aria-label="t('agent.helpful')"
        :aria-pressed="vote === 'up'"
        class="size-6"
        @click="setVote('up')"
      >
        <span class="icon-[lucide--thumbs-up] size-3" />
      </Button>
    </Tooltip>
    <Tooltip
      :config="t('agent.notHelpful')"
      side="top"
      :delay-duration="300"
      :ignore-non-keyboard-focus="false"
      disable-closing-trigger
      :collision-padding="8"
    >
      <Button
        type="button"
        :variant="vote === 'down' ? 'textonly' : 'muted-textonly'"
        size="icon-sm"
        :aria-label="t('agent.notHelpful')"
        :aria-pressed="vote === 'down'"
        class="size-6"
        @click="setVote('down')"
      >
        <span class="icon-[lucide--thumbs-down] size-3" />
      </Button>
    </Tooltip>
    <Tooltip
      v-if="assets.length"
      :config="t('agent.downloadAssets')"
      side="top"
      :delay-duration="300"
      :ignore-non-keyboard-focus="false"
      disable-closing-trigger
      :collision-padding="8"
    >
      <Button
        type="button"
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('agent.downloadAssets')"
        :disabled="downloading"
        class="size-6 rounded-lg"
        @click="downloadAssets"
      >
        <span class="icon-[lucide--download] size-3" />
      </Button>
    </Tooltip>
    <div
      class="flex h-6 w-14 rounded-lg transition-colors hover:bg-secondary-background-hover hover:text-base-foreground has-data-[state=open]:bg-secondary-background-hover has-data-[state=open]:text-base-foreground"
    >
      <Tooltip
        :config="copied ? t('agent.copied') : t('agent.copy')"
        side="top"
        :delay-duration="300"
        :ignore-non-keyboard-focus="false"
        disable-closing-trigger
        :collision-padding="8"
      >
        <Button
          type="button"
          variant="muted-textonly"
          size="unset"
          :aria-label="copied ? t('agent.copied') : t('agent.copy')"
          :class="
            cn(
              'h-6 w-8 rounded-l-lg rounded-r-none focus-visible:z-10',
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
        </Button>
      </Tooltip>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('agent.copyMarkdown')"
            class="size-6 rounded-l-none rounded-r-lg text-inherit focus-visible:z-10"
          >
            <span class="icon-[lucide--chevron-down] size-3" />
          </Button>
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
