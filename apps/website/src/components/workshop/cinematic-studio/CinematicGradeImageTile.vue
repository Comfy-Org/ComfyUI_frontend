<script setup lang="ts">
import { Pipette } from '@lucide/vue'
import { ref, useTemplateRef } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { sampleImageColors } from '../../../lib/workshop/cinematic-studio/colors'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import CinematicCheckBadge from './CinematicCheckBadge.vue'
import { useImagePreview } from './useImagePreview'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const file = defineModel<StudioImage | undefined>()
const emit = defineEmits<{ picked: [colors: readonly string[]] }>()
const preview = useImagePreview(() => file.value)
const input = useTemplateRef<HTMLInputElement>('input')
const unreadable = ref(false)

async function choose(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const [picked] = target.files ?? []
  target.value = ''
  if (!picked) return
  try {
    const colors = await sampleImageColors(picked)
    unreadable.value = false
    file.value = picked
    emit('picked', colors)
  } catch {
    unreadable.value = true
  }
}
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="!!file"
    :aria-label="tc('cinematic.grade.fromImageAction', locale)"
    class="group flex flex-col gap-2 text-left"
    data-testid="cinematic-grade-image"
    @click="input?.click()"
  >
    <span
      :class="
        cn(
          'relative flex aspect-video w-full overflow-hidden rounded-xl transition-shadow',
          file
            ? 'ring-2 ring-primary-warm-white'
            : 'place-items-center justify-center border border-dashed border-transparency-white-t20 text-primary-comfy-canvas group-hover:border-primary-warm-white/50 group-hover:text-primary-warm-white'
        )
      "
    >
      <img
        v-if="preview"
        :src="preview"
        alt=""
        class="size-full object-cover"
      />
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
            v-for="shade in 5"
            :key="shade"
            class="size-2 rounded-full border border-current opacity-60"
          />
        </span>
      </span>
      <CinematicCheckBadge v-if="file" />
    </span>
    <span
      class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
    >
      {{
        tc(
          file ? 'cinematic.grade.yourImage' : 'cinematic.grade.fromImage',
          locale
        )
      }}
    </span>
    <span
      v-if="unreadable"
      role="status"
      class="px-1 text-xs text-primary-comfy-canvas"
    >
      {{ tc('cinematic.colors.sampleError', locale) }}
    </span>
  </button>
  <input
    ref="input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    class="hidden"
    tabindex="-1"
    data-testid="cinematic-grade-image-input"
    @change="choose"
  />
</template>
