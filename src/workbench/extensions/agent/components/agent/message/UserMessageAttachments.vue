<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'
import { isHdrImageFilename } from '@/utils/hdrFormatUtil'

import type { UserAttachment } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { attachmentFileUrl } from '@/workbench/extensions/agent/utils/attachmentFileUrl'
import type { ReplyAsset } from '@/workbench/extensions/agent/utils/replyAssets'
import { isReplyAssetKind } from '@/workbench/extensions/agent/utils/replyAssets'

import ReplyAssetGroup from './ReplyAssetGroup.vue'

const { attachments } = defineProps<{
  attachments: UserAttachment[]
}>()

function attachmentIconClass(name: string): string {
  const kind = getMediaTypeFromFilename(name)
  return kind === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind)
}

function attachmentUrl(
  item: UserAttachment,
  kind: ReplyAsset['kind']
): string | undefined {
  const capturedUrl =
    kind === 'video' || kind === 'audio' ? item.mediaUrl : item.previewUrl
  if (capturedUrl) return capturedUrl
  if (!item.ref || isHdrImageFilename(item.name)) return
  return attachmentFileUrl({ ref: item.ref, id: item.id })
}

function gridAsset(item: UserAttachment): ReplyAsset | undefined {
  const kind = item.kind ?? getMediaTypeFromFilename(item.name)
  if (!isReplyAssetKind(kind)) return undefined
  const url = attachmentUrl(item, kind)
  if (!url) return undefined
  const filename = item.ref ?? item.name
  return {
    url,
    filename,
    kind,
    label: filename === item.name ? undefined : item.name
  }
}

const splitAttachments = computed(() => {
  const grid: ReplyAsset[] = []
  const plain: UserAttachment[] = []
  for (const item of attachments) {
    const asset = gridAsset(item)
    if (asset) grid.push(asset)
    else plain.push(item)
  }
  return { grid, plain }
})
</script>

<template>
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
        class="flex aspect-square w-full items-center justify-center rounded-lg bg-secondary"
      >
        <i
          aria-hidden="true"
          :class="
            cn(attachmentIconClass(item.name), 'size-6 text-muted-foreground')
          "
        />
      </div>
      <figcaption class="mt-0.5 truncate text-xs text-muted-foreground">
        {{ item.name }}
      </figcaption>
    </figure>
  </div>
</template>
