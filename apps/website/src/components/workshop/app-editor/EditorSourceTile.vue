<script setup lang="ts">
import { Film, ImagePlus, RefreshCw } from '@lucide/vue'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

/** The image or video a run starts from: always the first thing in the panel, on its own. */
const { kind, src, name, addLabel, changeLabel, inputTestId } = defineProps<{
  kind: 'image' | 'video'
  src?: string
  name?: string
  /** Says what to add while the tile is empty. */
  addLabel: string
  /** Names the action once something is chosen. */
  changeLabel: string
  /** Names the hidden file input, for tests to upload through. */
  inputTestId?: string
}>()

const emit = defineEmits<{ file: [file: File] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const over = ref(false)
const accept = kind === 'video' ? 'video/*' : 'image/png,image/jpeg,image/webp'

function take(file: File | undefined) {
  if (file?.type.startsWith(`${kind}/`)) emit('file', file)
}

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  take(event.target.files?.[0])
  event.target.value = ''
}

function onDrop(event: DragEvent) {
  over.value = false
  take(event.dataTransfer?.files[0])
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      :aria-label="src ? `${changeLabel}: ${name ?? ''}` : addLabel"
      :class="
        cn(
          'group relative grid aspect-video w-full place-items-center overflow-hidden rounded-xl border text-primary-warm-gray transition outline-none hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
          src
            ? 'border-transparency-white-t8 bg-primary-comfy-ink'
            : 'border-dashed border-transparency-white-t20 hover:border-primary-warm-white/50',
          over && 'border-primary-comfy-yellow'
        )
      "
      @click="input?.click()"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent.stop="onDrop"
    >
      <template v-if="src">
        <video
          v-if="kind === 'video'"
          :src
          muted
          playsinline
          preload="metadata"
          class="size-full object-cover"
        />
        <img v-else :src alt="" class="size-full object-cover" />
        <span
          class="absolute top-2 right-2 flex items-center gap-1.5 rounded-full bg-primary-comfy-ink/80 px-2.5 py-1 text-xs text-primary-warm-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden="true"
        >
          <RefreshCw class="size-3" />
          {{ changeLabel }}
        </span>
      </template>
      <span v-else class="flex flex-col items-center gap-2 text-sm">
        <component
          :is="kind === 'video' ? Film : ImagePlus"
          class="size-5"
          aria-hidden="true"
        />
        {{ addLabel }}
      </span>
    </button>
    <div v-if="src && $slots.default" class="absolute bottom-2 left-2">
      <slot />
    </div>
    <input
      ref="input"
      type="file"
      :accept
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      :data-testid="inputTestId"
      @change="onChange"
    />
  </div>
</template>
