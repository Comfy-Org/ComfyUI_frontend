<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DirectionGroup } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  group,
  selected,
  locale = 'en'
} = defineProps<{
  group: DirectionGroup
  selected: string
  locale?: Locale
}>()

const emit = defineEmits<{ choose: [id: string] }>()
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="option in group.options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      :class="
        cn(
          'h-8 rounded-lg border px-3 text-sm transition-colors',
          selected === option.id
            ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
            : 'border-transparency-white-t20 text-primary-comfy-canvas hover:border-primary-warm-white/60'
        )
      "
      @click="emit('choose', option.id)"
    >
      {{ tc(option.label, locale) }}
    </button>
  </div>
</template>
