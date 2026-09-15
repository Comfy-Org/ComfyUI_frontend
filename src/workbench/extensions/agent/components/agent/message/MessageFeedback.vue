<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ComponentProps } from 'vue-component-type-helpers'

import { cn } from '@comfyorg/tailwind-utils'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import AccessibleTooltip from '@/components/ui/tooltip/AccessibleTooltip.vue'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { useAssetDownload } from '@/platform/assets/composables/useAssetDownload'
import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'
import { resolveReplyAssetDownload } from '../../../utils/resolveReplyAssetDownload'
import type { ReplyAsset } from '../../../utils/replyAssets'

type DropdownEntries = NonNullable<
  ComponentProps<typeof DropdownMenu>['entries']
>

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

const copyMenuEntries = computed<DropdownEntries>(() => [
  {
    label: t('agent.copyMarkdown'),
    command: () => copyToClipboard(markdown)
  }
])

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
    <AccessibleTooltip
      :label="t('agent.helpful')"
      :skip-delay-duration="0"
      disable-hoverable-content
      :collision-padding="8"
    >
      <template #trigger>
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
      </template>
    </AccessibleTooltip>
    <AccessibleTooltip
      :label="t('agent.notHelpful')"
      :skip-delay-duration="0"
      disable-hoverable-content
      :collision-padding="8"
    >
      <template #trigger>
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
        </template>
      </AccessibleTooltip>
      <DropdownMenu :entries="copyMenuEntries" align="end" :side-offset="4">
        <template #button>
          <Button
            variant="muted-textonly"
            size="icon-sm"
            :aria-label="t('agent.copyMarkdown')"
            class="size-6 rounded-l-none rounded-r-lg text-inherit focus-visible:z-10"
          >
            <span class="icon-[lucide--chevron-down] size-3" />
          </Button>
        </template>
      </DropdownMenu>
    </div>
  </div>
</template>
