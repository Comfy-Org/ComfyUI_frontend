<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { LightColor } from '../../../lib/workshop/relight/lights'
import { LIGHT_COLORS } from '../../../lib/workshop/relight/lights'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const color = defineModel<LightColor>({ required: true })
</script>

<template>
  <div class="flex items-center gap-3 px-1">
    <span class="w-38 shrink-0 text-xs text-primary-warm-gray">{{
      lc('relight.color', locale)
    }}</span>
    <div
      role="radiogroup"
      :aria-label="lc('relight.color', locale)"
      class="flex items-center gap-2"
    >
      <button
        v-for="swatch in LIGHT_COLORS"
        :key="swatch.id"
        type="button"
        role="radio"
        :aria-checked="color === swatch.id"
        :aria-label="lc(swatch.name, locale)"
        :title="lc(swatch.name, locale)"
        :class="
          cn(
            'size-5 rounded-full border border-transparency-white-t20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow/70',
            color === swatch.id &&
              'ring-2 ring-primary-comfy-yellow ring-offset-2 ring-offset-primary-comfy-ink-light'
          )
        "
        :style="{ backgroundColor: swatch.hex }"
        @click="color = swatch.id"
      />
    </div>
  </div>
</template>
