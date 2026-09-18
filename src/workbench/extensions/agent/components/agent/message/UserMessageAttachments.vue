<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import { api } from '@/scripts/api'
import { getMediaTypeFromFilename } from '@/utils/formatUtil'

import type { UserAttachment } from '../../../stores/agent/agentConversationStore'
import type { ReplyAsset } from '../../../utils/replyAssets'
import ReplyAssetGroup from './ReplyAssetGroup.vue'

const { attachments, tags } = defineProps<{
  attachments: UserAttachment[]
  tags: string[]
}>()

function attachmentIconClass(name: string): string {
  const kind = getMediaTypeFromFilename(name)
  return kind === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind)
}

const splitAttachments = computed(() => {
  const grid: ReplyAsset[] = []
  const plain: UserAttachment[] = []
  for (const item of attachments) {
    const kind = getMediaTypeFromFilename(item.name)
    const url = item.ref
      ? api.apiURL(`/view?filename=${encodeURIComponent(item.ref)}&type=input`)
      : item.previewUrl
    if (
      url &&
      (kind === 'image' ||
        kind === 'video' ||
        kind === 'audio' ||
        kind === '3D')
    ) {
      grid.push({ url, filename: item.name, kind })
    } else {
      plain.push(item)
    }
  }
  return { grid, plain }
})
</script>

<template>
  <div v-if="tags.length" class="flex flex-wrap justify-end gap-1">
    <span
      v-for="(tag, index) in tags"
      :key="`${tag}:${index}`"
      class="inline-flex items-center gap-1 rounded-xl bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
    >
      <span class="icon-[lucide--at-sign] size-3 shrink-0" />
      <span class="max-w-40 truncate">{{ tag }}</span>
    </span>
  </div>
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
        class="flex aspect-square w-full items-center justify-center rounded-lg bg-secondary-background"
      >
        <span
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
