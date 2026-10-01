<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { LightKind } from '../../../lib/workshop/relight/lights'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const kind = defineModel<LightKind>({ required: true })

const KINDS = [
  { id: 'point', label: 'relight.kind.point' },
  { id: 'directional', label: 'relight.kind.directional' }
] as const
</script>

<template>
  <div class="flex items-center gap-3 px-1">
    <span class="w-38 shrink-0 text-xs text-primary-warm-gray">{{
      lc('relight.kind', locale)
    }}</span>
    <div
      role="radiogroup"
      :aria-label="lc('relight.kind', locale)"
      class="flex rounded-full bg-transparency-white-t4 p-0.5"
    >
      <button
        v-for="option in KINDS"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="kind === option.id"
        :class="
          cn(
            'h-6 rounded-full px-3 text-[11px] text-primary-warm-gray transition focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none',
            kind === option.id &&
              'bg-transparency-white-t20 text-primary-warm-white'
          )
        "
        @click="kind = option.id"
      >
        {{ lc(option.label, locale) }}
      </button>
    </div>
  </div>
</template>
