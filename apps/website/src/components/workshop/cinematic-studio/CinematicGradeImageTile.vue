<script setup lang="ts">
import { Pencil, Pipette } from '@lucide/vue'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { sampleImageColors } from '../../../lib/workshop/cinematic-studio/colors'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicCheckBadge from './CinematicCheckBadge.vue'

const PALETTE_SIZE = 5

const { colors, locale = 'en' } = defineProps<{
  colors: readonly string[]
  locale?: Locale
}>()

const emit = defineEmits<{ picked: [colors: readonly string[]]; edit: [] }>()
const input = useTemplateRef<HTMLInputElement>('input')
const unreadable = ref(false)

async function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  target.value = ''
  if (!picked) return
  try {
    const sampled = await sampleImageColors(picked, PALETTE_SIZE)
    unreadable.value = false
    emit('picked', sampled)
  } catch {
    unreadable.value = true
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-2">
    <button
      type="button"
      role="radio"
      :aria-checked="colors.length > 0"
      :aria-label="tc('cinematic.grade.fromImageAction', locale)"
      class="group flex flex-col gap-2 text-left"
      data-testid="cinematic-grade-image"
      @click="input?.click()"
    >
      <span
        :class="
          cn(
            'relative flex aspect-video w-full overflow-hidden rounded-xl transition-shadow',
            colors.length
              ? 'ring-2 ring-primary-warm-white'
              : 'place-items-center justify-center border border-dashed border-transparency-white-t20 text-primary-comfy-canvas group-hover:border-primary-warm-white/50 group-hover:text-primary-warm-white'
          )
        "
      >
        <template v-if="colors.length">
          <span
            v-for="(color, index) in colors"
            :key="index"
            class="h-full flex-1"
            :style="{ backgroundColor: color }"
          />
          <CinematicCheckBadge />
        </template>
        <span
          v-else
          class="flex size-full flex-col items-center justify-center gap-2.5"
          aria-hidden="true"
        >
          <span
            class="grid size-9 place-items-center rounded-full bg-transparency-white-t8"
          >
            <Pipette class="size-4" />
          </span>
          <span class="flex gap-1">
            <span
              v-for="shade in PALETTE_SIZE"
              :key="shade"
              class="size-2 rounded-full border border-current opacity-60"
            />
          </span>
        </span>
      </span>
      <span
        class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
      >
        {{
          tc(
            colors.length
              ? 'cinematic.grade.yourPalette'
              : 'cinematic.grade.fromImage',
            locale
          )
        }}
      </span>
    </button>
    <button
      v-if="colors.length"
      type="button"
      class="absolute top-2 left-2 flex h-7 items-center gap-1.5 rounded-lg bg-primary-comfy-ink/80 px-2 text-xs text-primary-warm-white hover:bg-primary-comfy-ink"
      @click="emit('edit')"
    >
      <Pencil class="size-3.5" aria-hidden="true" />
      {{ tc('cinematic.grade.edit', locale) }}
    </button>
    <span
      v-if="unreadable"
      role="status"
      class="px-1 text-xs text-primary-comfy-canvas"
    >
      {{ tc('cinematic.colors.sampleError', locale) }}
    </span>
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="hidden"
      tabindex="-1"
      data-testid="cinematic-grade-image-input"
      @change="choose"
    />
  </div>
</template>
