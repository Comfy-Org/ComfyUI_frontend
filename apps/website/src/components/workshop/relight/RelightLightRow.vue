<script setup lang="ts">
import { Eye, EyeOff, X } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import type { Light } from '../../../lib/workshop/relight/lights'
import RelightDots from './RelightDots.vue'

const {
  light,
  selected,
  locale = 'en'
} = defineProps<{
  light: Light
  selected: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ select: []; toggle: []; remove: [] }>()
</script>

<template>
  <li
    :class="
      cn(
        'flex h-8.5 items-center gap-1 rounded-lg pr-1 pl-2',
        selected && 'bg-transparency-white-t8'
      )
    "
  >
    <button
      type="button"
      :aria-pressed="selected"
      :class="
        cn(
          'flex min-w-0 flex-1 items-center gap-2 text-left text-xs text-primary-warm-white focus-visible:outline-none',
          !light.visible && 'opacity-50'
        )
      "
      @click="emit('select')"
    >
      <RelightDots :colors="[light.color]" />
      <span class="flex-1 truncate">{{ light.name }}</span>
      <span class="text-[10px] text-primary-warm-gray">{{
        lc(
          light.kind === 'point'
            ? 'relight.kind.point'
            : 'relight.kind.directional',
          locale
        )
      }}</span>
    </button>
    <button
      type="button"
      :aria-label="
        lc(
          light.visible ? 'relight.light.hide' : 'relight.light.show',
          locale,
          {
            name: light.name
          }
        )
      "
      class="flex size-6 items-center justify-center rounded-full text-primary-warm-gray hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @click="emit('toggle')"
    >
      <component
        :is="light.visible ? Eye : EyeOff"
        class="size-3"
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      :aria-label="lc('relight.light.remove', locale, { name: light.name })"
      class="flex size-6 items-center justify-center rounded-full text-primary-warm-gray hover:text-primary-warm-white focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      @click="emit('remove')"
    >
      <X class="size-3" aria-hidden="true" />
    </button>
  </li>
</template>
