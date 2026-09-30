<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const { disabled = false, locale = 'en' } = defineProps<{
  disabled?: boolean
  locale?: Locale
}>()
const mode = defineModel<'image' | 'video'>({ required: true })
</script>

<template>
  <div
    class="flex gap-1 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light p-1"
    role="group"
    :aria-label="tc('cinematic.video.mode', locale)"
  >
    <button
      v-for="option in ['image', 'video'] as const"
      :key="option"
      type="button"
      :disabled
      :aria-pressed="mode === option"
      :class="
        cn(
          'min-h-10 flex-1 rounded-lg px-5 text-sm font-semibold text-primary-warm-white transition-colors hover:bg-transparency-white-t8 disabled:opacity-50',
          mode === option && 'bg-transparency-white-t20'
        )
      "
      @click="mode = option"
    >
      {{
        tc(
          option === 'image'
            ? 'cinematic.video.image'
            : 'cinematic.video.video',
          locale
        )
      }}
    </button>
  </div>
</template>
