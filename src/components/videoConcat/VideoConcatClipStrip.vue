<template>
  <div class="flex flex-col gap-2">
    <div
      ref="stripRef"
      data-testid="video-concat-strip"
      role="list"
      :aria-label="t('videoConcat.clips')"
      class="flex gap-1.5 overflow-x-auto pb-1"
    >
      <VideoConcatClipTile
        v-for="(clip, position) in displayClips"
        :key="clip.name"
        role="listitem"
        tabindex="0"
        :aria-label="t('videoConcat.clipLabel', { position: position + 1 })"
        :name="clip.name"
        :url="clip.url"
        :position="position + 1"
        :active="clip.name === activeName"
        :dragging="!!ghost && clip.name === draggedClip?.name"
        @pointerdown="handlePointerDown($event, position)"
        @keydown="handleTileKeydown($event, position, clip.name)"
        @metadata="clip.url && emit('metadata', clip.url, $event)"
      />
    </div>
    <Teleport to="body">
      <div
        v-if="ghost && draggedClip"
        data-testid="video-concat-drag-ghost"
        class="pointer-events-none fixed z-toast rotate-2 overflow-hidden rounded-md border-2 border-primary bg-input shadow-lg"
        :style="{
          left: `${ghost.left}px`,
          top: `${ghost.top}px`,
          width: `${ghost.width}px`,
          height: `${ghost.height}px`
        }"
      >
        <img
          v-if="draggedThumbnail"
          data-testid="video-concat-drag-ghost-thumbnail"
          :src="draggedThumbnail"
          alt=""
          class="block size-full object-cover"
        />
        <span
          class="absolute top-1 left-1 rounded-sm bg-black/60 px-1 text-xs font-semibold text-white tabular-nums"
        >
          {{ (dragTo ?? 0) + 1 }}
        </span>
      </div>
    </Teleport>
    <p
      v-if="clips.length > 1"
      class="m-0 text-center text-xs text-muted-foreground"
    >
      {{ t('videoConcat.reorderHint') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

import VideoConcatClipTile from '@/components/videoConcat/VideoConcatClipTile.vue'
import { useClipStripReorder } from '@/composables/videoConcat/useClipStripReorder'
import type {
  ClipMetadata,
  ConcatClip
} from '@/composables/videoConcat/useVideoConcatClips'
import { moveItem } from '@/composables/videoConcat/videoConcatOrder'

const { clips, activeName, metadata } = defineProps<{
  clips: ConcatClip[]
  activeName?: string
  metadata: Record<string, ClipMetadata>
}>()

const emit = defineEmits<{
  reorder: [from: number, to: number]
  select: [index: number]
  metadata: [url: string, value: ClipMetadata]
}>()

const { t } = useI18n()

const stripRef = useTemplateRef<HTMLElement>('stripRef')

const { dragFrom, dragTo, ghost, handlePointerDown } = useClipStripReorder({
  stripRef,
  tileSelector: '[data-testid="video-concat-clip"]',
  onReorder: (from, to) => emit('reorder', from, to),
  onSelect: (index) => emit('select', index)
})

const displayClips = computed(() =>
  dragFrom.value === undefined || dragTo.value === undefined
    ? clips
    : moveItem(clips, dragFrom.value, dragTo.value)
)

const draggedClip = computed(() =>
  dragFrom.value === undefined ? undefined : clips[dragFrom.value]
)

const draggedThumbnail = computed(() => {
  const url = draggedClip.value?.url
  return url ? metadata[url]?.thumbnail : undefined
})

const REORDER_STEPS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 }

function focusTile(name: string) {
  const tile = stripRef.value?.querySelector<HTMLElement>(
    `[data-clip-name="${CSS.escape(name)}"]`
  )
  tile?.focus()
}

async function handleTileKeydown(
  event: KeyboardEvent,
  position: number,
  name: string
) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    emit('select', position)
    return
  }
  const step = event.altKey ? REORDER_STEPS[event.key] : undefined
  if (step === undefined) return
  event.preventDefault()
  event.stopPropagation()
  const target = position + step
  if (target < 0 || target >= clips.length) return
  emit('reorder', position, target)
  await nextTick()
  focusTile(name)
}
</script>
