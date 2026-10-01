<script setup lang="ts">
import { Pipette } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import { LIGHT_COLORS } from '../../../lib/workshop/relight/lights'

const { label, locale = 'en' } = defineProps<{
  label: string
  locale?: Locale
}>()
const color = defineModel<string>({ required: true })

const custom = computed(
  () => !LIGHT_COLORS.some((swatch) => swatch.hex === color.value)
)
const ring =
  'ring-2 ring-primary-warm-white ring-offset-2 ring-offset-primary-comfy-ink-light'

function onPick(event: Event) {
  if (event.target instanceof HTMLInputElement) color.value = event.target.value
}
</script>

<template>
  <div class="flex h-7 items-center justify-between gap-3 px-1">
    <span class="text-xs text-primary-warm-gray">{{ label }}</span>
    <div role="radiogroup" :aria-label="label" class="flex items-center gap-2">
      <button
        v-for="swatch in LIGHT_COLORS"
        :key="swatch.hex"
        type="button"
        role="radio"
        :aria-checked="color === swatch.hex"
        :aria-label="lc(swatch.name, locale)"
        :title="lc(swatch.name, locale)"
        :class="
          cn(
            'size-4 rounded-full border border-transparency-white-t20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow/70 disabled:opacity-40',
            color === swatch.hex && ring
          )
        "
        :style="{ backgroundColor: swatch.hex }"
        @click="color = swatch.hex"
      />
      <label
        :title="lc('relight.color.custom', locale)"
        :class="
          cn(
            'relative flex size-4 cursor-pointer items-center justify-center rounded-full border border-transparency-white-t20 text-primary-warm-gray focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-comfy-yellow/70',
            custom && ring
          )
        "
        :style="custom ? { backgroundColor: color } : undefined"
      >
        <Pipette v-if="!custom" class="size-2.5" aria-hidden="true" />
        <input
          type="color"
          :value="color"
          :aria-label="lc('relight.color.custom', locale)"
          class="absolute inset-0 size-full cursor-pointer opacity-0"
          @input="onPick"
        />
      </label>
    </div>
  </div>
</template>
