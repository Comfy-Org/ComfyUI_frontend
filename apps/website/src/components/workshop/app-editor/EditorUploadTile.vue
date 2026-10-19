<script setup lang="ts">
import { Upload } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import EditorUploadSlot from './EditorUploadSlot.vue'
import type { TileAspect } from './tile-classes'
import { TILE_ASPECT, tileCaption } from './tile-classes'

const { label, caption, inputTestId, aspect, large } = defineProps<{
  label: string
  caption?: string
  inputTestId?: string
  aspect: TileAspect
  large: boolean
}>()

const emit = defineEmits<{ file: [file: File] }>()
</script>

<template>
  <EditorUploadSlot
    :label
    :input-test-id
    class="group flex min-w-0 flex-col gap-1 text-left focus-visible:outline-none disabled:opacity-40"
    @file="emit('file', $event)"
  >
    <span
      :class="
        cn(
          'flex w-full items-center justify-center rounded-lg border border-dashed border-transparency-white-t20 text-primary-warm-gray transition group-hover:bg-transparency-white-t4 group-hover:text-primary-warm-white group-focus-visible:ring-2 group-focus-visible:ring-primary-comfy-yellow/60',
          TILE_ASPECT[aspect]
        )
      "
    >
      <Upload :class="large ? 'size-5' : 'size-4'" aria-hidden="true" />
    </span>
    <span
      :class="
        cn(
          'truncate text-primary-warm-gray group-hover:text-primary-comfy-canvas',
          tileCaption(large)
        )
      "
      >{{ caption ?? label }}</span
    >
  </EditorUploadSlot>
</template>
