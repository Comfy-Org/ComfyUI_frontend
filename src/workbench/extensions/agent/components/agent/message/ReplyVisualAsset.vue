<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { ReplyVisualAsset } from '@/workbench/extensions/agent/utils/replyAssets'

const { asset, multi, modelThumbnailSrc } = defineProps<{
  asset: ReplyVisualAsset
  multi: boolean
  modelThumbnailSrc: string
}>()

defineEmits<{ inspect: [] }>()

const { t } = useI18n()

const previewing = ref(false)

const name = computed(() => asset.label ?? asset.filename)

const label = computed(() =>
  asset.kind === 'video'
    ? t('agent.openVideo', { name: name.value }, { escapeParameter: false })
    : name.value
)

const showPlayBadge = computed(
  () => asset.kind === 'video' && !previewing.value
)

function playPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) void video.play().catch(() => {})
}

function stopPreview(event: Event): void {
  const video = event.target
  if (video instanceof HTMLVideoElement) video.pause()
}

function clearPreviewingUnlessLooping(event: Event): void {
  if (event.target instanceof HTMLVideoElement && event.target.seeking) return
  previewing.value = false
}
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    :class="
      cn(
        'relative cursor-pointer overflow-hidden rounded-lg border-none p-0',
        multi && 'aspect-square bg-accent',
        !multi && asset.kind === '3D' && 'justify-self-end'
      )
    "
    @click="$emit('inspect')"
  >
    <img
      v-if="asset.kind === 'image'"
      :src="asset.url"
      :alt="name"
      data-testid="reply-image-preview"
      loading="lazy"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
    />
    <video
      v-else-if="asset.kind === 'video'"
      :src="asset.url"
      data-testid="reply-video-preview"
      muted
      loop
      playsinline
      preload="metadata"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
      @mouseenter="playPreview"
      @mouseleave="stopPreview"
      @playing="previewing = true"
      @pause="previewing = false"
      @waiting="clearPreviewingUnlessLooping"
    />
    <img
      v-else-if="modelThumbnailSrc"
      :src="modelThumbnailSrc"
      :alt="name"
      loading="lazy"
      :class="multi ? 'size-full object-cover' : 'block h-auto max-w-full'"
    />
    <span
      v-else
      :class="
        cn(
          'flex items-center justify-center',
          multi ? 'size-full' : 'aspect-square w-40 bg-accent'
        )
      "
    >
      <i
        aria-hidden="true"
        class="icon-[lucide--box] size-6 text-muted-foreground"
      />
    </span>
    <span
      v-if="showPlayBadge"
      data-testid="reply-video-affordance"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        class="flex size-9 items-center justify-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm"
      >
        <i aria-hidden="true" class="icon-[lucide--play] fill-current" />
      </span>
    </span>
  </button>
</template>
