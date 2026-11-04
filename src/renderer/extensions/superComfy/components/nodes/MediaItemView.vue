<script setup lang="ts">
import AudioPreview from '@comfyorg/design-system/media/AudioPreview'
import VideoPreview from '@comfyorg/design-system/media/VideoPreview'
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MediaItem } from '@/renderer/extensions/superComfy/engine/documentSchema'
import {
  itemPreviewUrl,
  itemViewUrl
} from '@/renderer/extensions/superComfy/media/superMedia'

const Preview3d = defineAsyncComponent(
  () => import('@/renderer/extensions/linearMode/Preview3d.vue')
)

const { item, selected } = defineProps<{
  item: MediaItem
  selected: boolean
}>()

const { t } = useI18n()

const view = computed(() => (item.kind === 'text' ? 'text' : item.modality))
const viewUrl = computed(() => itemViewUrl(item))
const fileName = computed(() => (item.kind === 'file' ? item.ref.filename : ''))
const isTemporary = computed(() => item.kind === 'link')
</script>

<template>
  <p
    v-if="item.kind === 'text'"
    class="max-h-64 overflow-auto p-3 text-xs whitespace-pre-wrap"
  >
    {{ item.text }}
  </p>
  <img
    v-else-if="view === 'image'"
    :src="itemPreviewUrl(item)"
    :alt="fileName"
    class="size-full object-contain"
    draggable="false"
  />
  <div v-else-if="view === 'video'" class="flex flex-col" data-no-drag>
    <VideoPreview :src="viewUrl" class="w-full" />
  </div>
  <AudioPreview
    v-else-if="view === 'audio'"
    :audio-urls="[viewUrl]"
    class="py-3"
    data-no-drag
  />
  <div v-else class="flex min-h-32 flex-col items-center justify-center gap-2">
    <Preview3d
      v-if="selected"
      :model-url="viewUrl"
      class="h-48 w-full"
      data-no-drag
      @wheel.stop
    />
    <template v-else>
      <i class="icon-[lucide--box] size-6 text-muted-foreground" />
      <span class="max-w-full truncate px-3 text-muted-foreground">
        {{ fileName }}
      </span>
    </template>
  </div>
  <span
    v-if="isTemporary"
    class="absolute top-2 left-2 rounded-sm bg-background/80 px-1 text-2xs text-muted-foreground"
  >
    {{ t('superComfy.node.temporary') }}
  </span>
</template>
