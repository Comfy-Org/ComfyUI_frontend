<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { DirectionGroup } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicOptionIcon from './CinematicOptionIcon.vue'

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
  <div
    role="radiogroup"
    :aria-label="tc(group.title, locale)"
    class="flex min-w-0 flex-col gap-1.5 rounded-xl border border-transparency-white-t8 p-2"
  >
    <h3 class="py-2 text-center text-sm font-semibold text-primary-warm-white">
      {{ tc(group.title, locale) }}
    </h3>
    <button
      v-for="option in group.options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      :class="
        cn(
          'flex h-14 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition-colors',
          selected === option.id
            ? 'border-primary-warm-white bg-transparency-white-t8 text-primary-warm-white'
            : 'border-transparent bg-transparency-white-t4 text-primary-warm-gray hover:bg-transparency-white-t8 hover:text-primary-warm-white'
        )
      "
      @click="emit('choose', option.id)"
    >
      <span class="truncate">{{ tc(option.label, locale) }}</span>
      <CinematicOptionIcon
        :part="group.part"
        :option="option.id"
        class="h-8 w-12 shrink-0"
      />
    </button>
  </div>
</template>
