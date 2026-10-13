<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useElementVisibility } from '@vueuse/core'
import { FileImage } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'

const {
  preview,
  label,
  unavailable,
  expanded = false
} = defineProps<{
  preview?: { kind: 'image' | 'video'; src: string }
  label: string
  unavailable: string
  expanded?: boolean
}>()
const target = useTemplateRef<HTMLElement>('target')
const visible = useElementVisibility(target)
const failed = ref(false)
const loadVideo = computed(() => expanded || visible.value)
function firstFrame(event: Event) {
  if (!(event.target instanceof HTMLVideoElement)) return
  const video = event.target
  if (!Number.isFinite(video.duration) || video.duration <= 0) return
  try {
    video.currentTime = Math.min(0.1, video.duration / 2)
  } catch {
    failed.value = true
  }
}
</script>
<template>
  <div
    ref="target"
    :class="
      cn(
        'flex items-center justify-center overflow-hidden rounded-md border border-admin-line bg-admin-raised',
        expanded ? 'aspect-video w-full max-w-xl' : 'size-10 sm:size-12'
      )
    "
  >
    <img
      v-if="preview?.kind === 'image' && !failed"
      :src="preview.src"
      :alt="label"
      loading="lazy"
      class="size-full object-contain"
      @error="failed = true"
    />
    <video
      v-else-if="preview?.kind === 'video' && !failed"
      :src="loadVideo ? preview.src : undefined"
      :aria-label="label"
      preload="metadata"
      muted
      playsinline
      class="size-full object-contain"
      @loadedmetadata="firstFrame"
      @error="failed = true"
    />
    <span
      v-else
      role="img"
      :aria-label="unavailable"
      :title="unavailable"
      class="text-admin-muted"
      ><FileImage class="size-5" aria-hidden="true"
    /></span>
  </div>
</template>
