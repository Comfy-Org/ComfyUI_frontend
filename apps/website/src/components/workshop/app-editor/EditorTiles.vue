<script setup lang="ts" generic="T extends string">
import { cn } from '@comfyorg/tailwind-utils'

import EditorTile from './EditorTile.vue'
import EditorUploadTile from './EditorUploadTile.vue'
import type { TileAspect } from './tile-classes'
import { TILE_ASPECT } from './tile-classes'

const {
  label,
  options,
  columns = 3,
  aspect = 'video',
  busy = false,
  upload
} = defineProps<{
  label: string
  /** Each tile shows `src` unless the `tile` slot draws it. */
  options: readonly { id: T; label: string; src?: string }[]
  /** Two columns make large tiles that mark the picked one with a check. */
  columns?: 2 | 3 | 4
  /** `square` for pictures of things, `photo` (3:2) for places. */
  aspect?: TileAspect
  /** Holds placeholders while the options load. */
  busy?: boolean
  /**
   * Ends the grid with a tile that takes the visitor's own image, named
   * `label` and captioned `caption` when that differs.
   */
  upload?: { label: string; caption?: string; inputTestId?: string }
}>()

const emit = defineEmits<{
  upload: [file: File]
  /** Every click on a tile, the picked one included. */
  pick: [id: T]
}>()

const GRID = {
  2: 'grid-cols-2 gap-x-4 gap-y-5',
  3: 'grid-cols-3 gap-x-2 gap-y-3.5',
  4: 'grid-cols-4 gap-x-2 gap-y-3'
} as const
const value = defineModel<T>()
const large = columns === 2

function pick(id: T) {
  value.value = id
  emit('pick', id)
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    :aria-busy="busy || undefined"
    :class="cn('grid px-1', GRID[columns])"
  >
    <template v-if="busy">
      <span
        v-for="index in 4"
        :key="index"
        :class="
          cn(
            'w-full rounded-lg bg-transparency-white-t4 motion-safe:animate-pulse',
            TILE_ASPECT[aspect]
          )
        "
        aria-hidden="true"
      />
    </template>
    <template v-else>
      <EditorTile
        v-for="option in options"
        :key="option.id"
        :label="option.label"
        :src="option.src"
        :checked="value === option.id"
        :aspect
        :large
        @pick="pick(option.id)"
      >
        <slot name="tile" :option />
      </EditorTile>
    </template>
    <EditorUploadTile
      v-if="upload"
      :label="upload.label"
      :caption="upload.caption"
      :input-test-id="upload.inputTestId"
      :aspect
      :large
      @file="emit('upload', $event)"
    />
  </div>
</template>
