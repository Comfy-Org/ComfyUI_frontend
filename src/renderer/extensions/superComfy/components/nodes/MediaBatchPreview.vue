<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import MediaLightbox from '@/components/sidebar/tabs/queue/MediaLightbox.vue'
import type { MediaItem } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { toResultItem } from '@/renderer/extensions/superComfy/media/superMedia'

import MediaItemView from './MediaItemView.vue'
import type { BatchEntry } from './nodeView'

const {
  entries,
  selected,
  dimmed = false
} = defineProps<{
  entries: readonly BatchEntry[]
  selected: boolean
  dimmed?: boolean
}>()

const index = defineModel<number>('index', { required: true })

const { t } = useI18n()
const lightboxIndex = ref(-1)

function isGalleryItem(item: MediaItem): boolean {
  return (
    item.kind !== 'text' &&
    (item.modality === 'image' || item.modality === 'video')
  )
}

const galleryItems = computed(() =>
  entries.flatMap((entry) =>
    entry.kind === 'item' && isGalleryItem(entry.item) ? [entry.item] : []
  )
)
const galleryResults = computed(() => galleryItems.value.map(toResultItem))
const current = computed<BatchEntry | undefined>(() => entries[index.value])
const canExpand = computed(
  () => current.value?.kind === 'item' && isGalleryItem(current.value.item)
)

const failureText = computed(() => {
  const entry = current.value
  if (entry?.kind !== 'failed') return ''
  if (entry.message) return entry.message
  return entry.code === 'noOutput'
    ? t('superComfy.node.noOutput')
    : t('superComfy.node.failed', { count: 1 })
})

function openLightbox() {
  const entry = current.value
  if (entry?.kind !== 'item') return
  lightboxIndex.value = galleryItems.value.indexOf(entry.item)
}
</script>

<template>
  <div
    :class="
      cn(
        'relative flex min-h-0 flex-1 flex-col items-stretch justify-center transition-opacity',
        dimmed && 'opacity-60'
      )
    "
  >
    <slot v-if="!current" name="empty" />
    <div
      v-else-if="current.kind === 'failed'"
      class="flex flex-col items-center gap-2 p-4 text-center text-destructive"
    >
      <i class="icon-[lucide--circle-alert] size-5" />
      <span class="line-clamp-4 wrap-break-word">{{ failureText }}</span>
    </div>
    <MediaItemView v-else :item="current.item" :selected />
    <Button
      v-if="canExpand"
      variant="secondary"
      size="icon-sm"
      class="absolute top-2 right-2 opacity-0 group-hover/node:opacity-100"
      :aria-label="t('mediaAsset.actions.zoom')"
      @click="openLightbox"
    >
      <i class="icon-[lucide--maximize-2] size-3" />
    </Button>
    <MediaLightbox
      v-if="lightboxIndex >= 0"
      v-model:active-index="lightboxIndex"
      :all-gallery-items="galleryResults"
    />
  </div>
</template>
