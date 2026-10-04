<script setup lang="ts">
import { CircleDashed } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { DirectionGroup } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { translationsFor } from '../../../i18n/translations'
import CinematicCheckBadge from './CinematicCheckBadge.vue'

const {
  group,
  selected,
  locale = 'en'
} = defineProps<{
  group: DirectionGroup
  selected: string
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const emit = defineEmits<{ choose: [id: string] }>()
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="tc(group.title)"
    class="grid grid-cols-2 gap-x-4 gap-y-5"
  >
    <slot />
    <template v-for="(option, index) in group.options" :key="option.id">
      <button
        type="button"
        role="radio"
        :aria-checked="selected === option.id"
        class="group flex flex-col gap-2 text-left"
        @click="emit('choose', option.id)"
      >
        <span
          :class="
            cn(
              'relative flex aspect-video w-full overflow-hidden rounded-xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8 transition-shadow group-hover:ring-transparency-white-t20',
              selected === option.id &&
                'ring-2 ring-primary-warm-white group-hover:ring-primary-warm-white'
            )
          "
        >
          <img
            v-if="option.preview"
            :src="option.preview"
            alt=""
            loading="lazy"
            class="size-full object-cover"
          />
          <span
            v-else-if="!option.palette"
            class="grid size-full place-items-center text-primary-warm-gray"
          >
            <CircleDashed class="size-8" aria-hidden="true" />
          </span>
          <template v-else>
            <span
              v-for="(color, index) in option.palette"
              :key="index"
              class="h-full flex-1"
              :style="{ backgroundColor: color }"
            />
          </template>
          <CinematicCheckBadge v-if="selected === option.id" />
        </span>
        <span
          class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
        >
          {{ tc(option.label) }}
        </span>
      </button>
      <slot v-if="index === 0" name="row" />
    </template>
  </div>
</template>
