<script setup lang="ts">
import { Film, ImagePlus, X } from '@lucide/vue'
import { useTemplateRef } from 'vue'

/**
 * The image or video a run starts from, always first in the panel: an upload
 * button until one is chosen, then its cover with the name over it and an X to
 * take it out. Anything the app adds about it sits in a quiet box underneath.
 */
const { kind, src, caption, addLabel, hint, removeLabel, inputTestId } =
  defineProps<{
    kind: 'image' | 'video'
    src?: string
    /** The name, and anything else worth knowing, shown over the cover. */
    caption?: string
    /** Says what to add while the tile is empty. */
    addLabel: string
    /** What fits, under the add label. */
    hint?: string
    /** Names the X that takes the source out. */
    removeLabel: string
    /** Names the hidden file input, for tests to upload through. */
    inputTestId?: string
  }>()

const emit = defineEmits<{ file: [file: File]; remove: [] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const accept = kind === 'video' ? 'video/*' : 'image/png,image/jpeg,image/webp'

function onChange(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file?.type.startsWith(`${kind}/`)) emit('file', file)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="src"
      class="relative aspect-video overflow-hidden rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink"
    >
      <video
        v-if="kind === 'video'"
        :src
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
        class="size-full object-cover"
      />
      <img v-else :src alt="" class="size-full object-cover" />
      <span
        v-if="caption"
        class="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-primary-comfy-ink/85 to-transparent px-2.5 pt-6 pb-2 text-xs text-primary-warm-white"
      >
        {{ caption }}
      </span>
      <button
        type="button"
        :aria-label="removeLabel"
        class="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-full bg-primary-comfy-ink/85 text-primary-warm-white transition hover:bg-primary-comfy-ink focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
        @click="emit('remove')"
      >
        <X class="size-3.5" aria-hidden="true" />
      </button>
    </div>
    <button
      v-else
      type="button"
      class="flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-transparency-white-t20 text-primary-warm-gray transition outline-none hover:border-primary-warm-white/50 hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
      @click="input?.click()"
    >
      <component
        :is="kind === 'video' ? Film : ImagePlus"
        class="size-5"
        aria-hidden="true"
      />
      <span class="text-sm text-primary-warm-white">{{ addLabel }}</span>
      <span v-if="hint" class="text-xs">{{ hint }}</span>
    </button>
    <div
      v-if="src && $slots.default"
      class="flex items-center gap-1.5 rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-2.5 py-2 text-xs text-primary-warm-gray"
    >
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
