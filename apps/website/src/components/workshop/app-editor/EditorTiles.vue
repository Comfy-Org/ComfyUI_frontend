<script setup lang="ts" generic="T extends string">
import { Upload } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import CinematicCheckBadge from '../cinematic-studio/CinematicCheckBadge.vue'
import EditorUploadSlot from './EditorUploadSlot.vue'

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
  aspect?: 'video' | 'square' | 'photo'
  /** Holds placeholders while the options load. */
  busy?: boolean
  /**
   * Ends the grid with a tile that takes the visitor's own image, named
   * `label` and captioned `caption` when that differs.
   */
  upload?: { label: string; caption?: string; inputTestId?: string }
}>()

const emit = defineEmits<{ upload: [file: File] }>()

const GRID = {
  2: 'grid-cols-2 gap-x-4 gap-y-5',
  3: 'grid-cols-3 gap-x-2 gap-y-3.5',
  4: 'grid-cols-4 gap-x-2 gap-y-3'
} as const
const ASPECT = {
  video: 'aspect-video',
  square: 'aspect-square',
  photo: 'aspect-3/2'
} as const
const value = defineModel<T>()

const large = () => columns === 2
const caption = () => (large() ? 'px-1 text-sm' : 'text-[11px] tracking-tight')
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
            ASPECT[aspect]
          )
        "
        aria-hidden="true"
      />
    </template>
    <template v-else>
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="value === option.id"
        class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
        @click="value = option.id"
      >
        <span
          :class="
            cn(
              'relative block w-full overflow-hidden rounded-lg ring-1 ring-transparency-white-t8 transition group-hover:ring-transparency-white-t20 group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
              ASPECT[aspect],
              value === option.id &&
                'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
            )
          "
        >
          <slot name="tile" :option>
            <img
              v-if="option.src"
              :src="option.src"
              alt=""
              loading="lazy"
              class="size-full object-cover"
            />
          </slot>
          <CinematicCheckBadge v-if="large() && value === option.id" />
        </span>
        <span
          :class="
            cn(
              'truncate text-primary-warm-gray group-hover:text-primary-comfy-canvas',
              caption(),
              value === option.id && 'text-primary-warm-white'
            )
          "
          >{{ option.label }}</span
        >
      </button>
    </template>
    <EditorUploadSlot
      v-if="upload"
      :label="upload.label"
      :input-test-id="upload.inputTestId"
      class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
      @file="emit('upload', $event)"
    >
      <span
        :class="
          cn(
            'flex w-full items-center justify-center rounded-lg border border-dashed border-transparency-white-t20 text-primary-warm-gray transition group-hover:bg-transparency-white-t4 group-hover:text-primary-warm-white group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
            ASPECT[aspect]
          )
        "
      >
        <Upload :class="large() ? 'size-5' : 'size-4'" aria-hidden="true" />
      </span>
      <span
        :class="
          cn(
            'truncate text-primary-warm-gray group-hover:text-primary-comfy-canvas',
            caption()
          )
        "
        >{{ upload.caption ?? upload.label }}</span
      >
    </EditorUploadSlot>
  </div>
</template>
