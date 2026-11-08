<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { MediaKind } from '@/platform/assets/schemas/mediaAssetSchema'
import { startAssetDrag } from '@/platform/assets/utils/assetDragUtil'
import { resolvePreviewUrl } from '@/platform/assets/utils/assetPreviewUtil'
import { getAssetFileUrl } from '@/platform/assets/utils/assetUrlUtil'
import { iconForMediaType } from '@/platform/assets/utils/mediaIconUtil'
import Button from '@comfyorg/design-system/button/Button'
import { cn } from '@comfyorg/tailwind-utils'

const {
  asset,
  kind,
  name,
  selected,
  inMessage,
  stackCount = 1,
  stackExpanded = false,
  stackLoading = false
} = defineProps<{
  asset: AssetItem
  kind: MediaKind
  name: string
  selected: boolean
  inMessage: boolean
  stackCount?: number
  stackExpanded?: boolean
  stackLoading?: boolean
}>()
const emit = defineEmits<{ toggle: []; preview: []; toggleStack: [] }>()

const { t } = useI18n()

const imageUrl = computed(() => asset.thumbnail_url || resolvePreviewUrl(asset))
const videoUrl = computed(() =>
  getAssetFileUrl(asset, { disposition: 'inline' })
)
const kindIconClass = computed(() =>
  kind === 'other' ? 'icon-[lucide--file]' : iconForMediaType(kind)
)
const previewable = computed(() => kind !== 'text' && kind !== 'other')
const stacked = computed(() => stackCount > 1)
const hasBadges = computed(() => inMessage || stacked.value)
const stackLabel = computed(() =>
  stackExpanded
    ? t('agent.outputs.hideRest')
    : t('agent.outputs.showRest', stackCount - 1)
)
const stackIconClass = computed(() =>
  stackLoading
    ? 'icon-[lucide--loader-circle] motion-safe:animate-spin'
    : 'icon-[lucide--layers]'
)

function playPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) void video.play().catch(() => {})
}

function stopPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) video.pause()
}
</script>

<template>
  <li
    draggable="true"
    data-testid="agent-output-tile"
    class="group relative aspect-square list-none overflow-hidden rounded-lg bg-accent"
    @dragstart="startAssetDrag($event, asset)"
  >
    <button
      type="button"
      :aria-pressed="selected"
      :aria-label="t('agent.outputs.select', { name })"
      class="block size-full cursor-pointer p-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
      @click="emit('toggle')"
    >
      <img
        v-if="kind === 'image'"
        :src="imageUrl"
        :alt="name"
        loading="lazy"
        draggable="false"
        class="size-full object-cover"
      />
      <template v-else-if="kind === 'video'">
        <video
          :src="videoUrl"
          data-testid="agent-output-tile-video"
          muted
          loop
          playsinline
          preload="metadata"
          class="size-full object-cover"
          @mouseenter="playPreview"
          @mouseleave="stopPreview"
        />
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <span
            class="flex size-7 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm"
          >
            <i
              aria-hidden="true"
              class="icon-[lucide--play] size-3.5 fill-current"
            />
          </span>
        </span>
      </template>
      <span
        v-else
        class="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-muted-foreground"
      >
        <span
          aria-hidden="true"
          :class="cn(kindIconClass, 'size-6 shrink-0')"
        />
        <span class="w-full truncate text-center text-xs">{{ name }}</span>
      </span>
    </button>

    <span
      v-if="selected"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-primary ring-inset"
    >
      <span
        class="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-foreground"
      >
        <i aria-hidden="true" class="icon-[lucide--check] size-3.5" />
      </span>
    </span>

    <Button
      v-if="previewable"
      type="button"
      variant="textonly"
      size="unset"
      :aria-label="t('agent.outputs.preview', { name })"
      class="absolute top-1.5 right-1.5 size-6 rounded-md bg-black/60 p-0 text-white opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-black/80 hover:text-white focus-visible:outline-2 focus-visible:outline-foreground"
      @click="emit('preview')"
    >
      <i aria-hidden="true" class="icon-[lucide--maximize-2] size-3.5" />
    </Button>

    <div
      v-if="hasBadges"
      class="pointer-events-none absolute inset-x-1.5 bottom-1.5 flex items-end gap-1"
    >
      <span
        v-if="inMessage"
        class="min-w-0 truncate rounded-sm bg-background/90 px-1.5 py-0.5 text-2xs text-foreground"
      >
        {{ t('agent.outputs.inMessage') }}
      </span>
      <Button
        v-if="stacked"
        type="button"
        variant="textonly"
        size="unset"
        :aria-expanded="stackExpanded"
        :aria-busy="stackLoading || undefined"
        :aria-label="stackLabel"
        class="pointer-events-auto ml-auto h-5 shrink-0 gap-1 rounded-sm bg-black/60 px-1.5 py-0 text-2xs text-white hover:bg-black/80 hover:text-white focus-visible:outline-2 focus-visible:outline-foreground"
        @click="emit('toggleStack')"
      >
        <i aria-hidden="true" :class="cn('size-3', stackIconClass)" />
        {{ stackCount }}
      </Button>
    </div>
  </li>
</template>
