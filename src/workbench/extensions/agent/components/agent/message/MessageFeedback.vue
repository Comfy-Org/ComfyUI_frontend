<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import Button from '@comfyorg/design-system/button/Button'
import ButtonGroup from '@comfyorg/design-system/button-group/ButtonGroup'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import Tooltip from '@comfyorg/design-system/tooltip/Tooltip'
import TooltipContent from '@comfyorg/design-system/tooltip/TooltipContent'
import TooltipTrigger from '@comfyorg/design-system/tooltip/TooltipTrigger'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { resolveReplyAssetDownload } from '@/workbench/extensions/agent/utils/resolveReplyAssetDownload'
import type { ReplyAsset } from '@/workbench/extensions/agent/utils/replyAssets'

const { markdown, assets = [] } = defineProps<{
  markdown: string
  assets?: ReplyAsset[]
}>()
const emit = defineEmits<{ feedback: [vote: 'up' | 'down' | null] }>()

const { t } = useI18n()
const { copied, copyToClipboard } = useCopyToClipboard({
  copiedDuring: 2000,
  showSuccessToast: false
})
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
  void copyToClipboard(doc.body.textContent?.trim() ?? '')
}

const downloading = ref(false)
const copyMenuItems = computed<MenuItem[]>(() => [
  {
    label: t('agent.copyMarkdown'),
    command: () => copyToClipboard(markdown)
  }
])

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
  <div class="flex w-full items-center gap-1 text-muted-foreground">
    <Button
      :tooltip="t('agent.helpful')"
      type="button"
      :variant="vote === 'up' ? 'textonly' : 'muted-textonly'"
      size="icon-sm"
      :aria-label="t('agent.helpful')"
      :aria-pressed="vote === 'up'"
      @click="setVote('up')"
    >
      <i aria-hidden="true" class="icon-[lucide--thumbs-up] size-3" />
    </Button>
    <Button
      :tooltip="t('agent.notHelpful')"
      type="button"
      :variant="vote === 'down' ? 'textonly' : 'muted-textonly'"
      size="icon-sm"
      :aria-label="t('agent.notHelpful')"
      :aria-pressed="vote === 'down'"
      @click="setVote('down')"
    >
      <i aria-hidden="true" class="icon-[lucide--thumbs-down] size-3" />
    </Button>
    <Button
      v-if="assets.length"
      :tooltip="t('agent.downloadAssets')"
      type="button"
      variant="muted-textonly"
      size="icon-sm"
      :aria-label="t('agent.downloadAssets')"
      :disabled="downloading"
      @click="downloadAssets"
    >
      <i aria-hidden="true" class="icon-[lucide--download] size-3" />
    </Button>
    <ButtonGroup class="overflow-visible">
      <Tooltip disable-closing-trigger>
        <TooltipTrigger as-child>
          <Button
            type="button"
            :variant="copied ? 'textonly' : 'muted-textonly'"
            size="icon-sm"
            :aria-label="copied ? t('agent.copied') : t('agent.copy')"
            @click="copyPlainText()"
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
      <Menu
        :items="copyMenuItems"
        align="end"
        :side-offset="4"
        class="agent-scope"
      >
        <template #trigger>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('agent.copyMarkdown')"
          >
            <i aria-hidden="true" class="icon-[lucide--chevron-down] size-3" />
          </Button>
        </template>
      </Menu>
    </ButtonGroup>
  </div>
</template>
