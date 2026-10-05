<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '@/i18n/translations'
import CinematicTooltip from './CinematicTooltip.vue'

const {
  video = false,
  locale = 'en',
  class: className
} = defineProps<{
  /** A video shot's enhance line describes motion, not a still. */
  video?: boolean
  locale?: Locale
  class?: string
}>()
const { t } = translationsFor(locale)

const hint = computed(() =>
  t(video ? 'cinematic.video.enhanceHint' : 'cinematic.scene.enhanceHint')
)

const enhance = defineModel<boolean>({ required: true })
</script>

<template>
  <CinematicTooltip :text="hint">
    <label
      :class="
        cn(
          'flex w-fit cursor-pointer items-center gap-2.5 text-xs text-primary-warm-white',
          className
        )
      "
    >
      <input
        v-model="enhance"
        type="checkbox"
        role="switch"
        :aria-description="hint"
        class="peer sr-only"
      />
      <span
        class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
        aria-hidden="true"
      />
      {{ t('cinematic.scene.enhance') }}
    </label>
  </CinematicTooltip>
</template>
