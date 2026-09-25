<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootSound, ReshootView } from './output'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const view = defineModel<ReshootView>('view', { required: true })
const sound = defineModel<ReshootSound>('sound', { required: true })

const VIEWS: readonly ReshootView[] = ['result', 'warp', 'source']
const SOUNDS: readonly ReshootSound[] = ['generated', 'original']

const optionClass = (active: boolean) =>
  cn(
    'h-7 rounded-lg px-3 text-xs whitespace-nowrap transition-colors',
    active
      ? 'bg-primary-warm-white text-primary-comfy-ink'
      : 'text-primary-comfy-canvas hover:text-primary-warm-white'
  )
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div
      class="flex rounded-xl bg-primary-comfy-ink/85 p-0.5"
      role="radiogroup"
      :aria-label="rc('reshoot.views', locale)"
    >
      <button
        v-for="option in VIEWS"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="view === option"
        :class="optionClass(view === option)"
        @click="view = option"
      >
        {{ rc(`reshoot.view.${option}`, locale) }}
      </button>
    </div>
    <div
      v-if="view === 'result'"
      class="flex rounded-xl bg-primary-comfy-ink/85 p-0.5"
      role="radiogroup"
      :aria-label="rc('reshoot.sound', locale)"
    >
      <button
        v-for="option in SOUNDS"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="sound === option"
        :class="optionClass(sound === option)"
        @click="sound = option"
      >
        {{ rc(`reshoot.sound.${option}`, locale) }}
      </button>
    </div>
  </div>
</template>
