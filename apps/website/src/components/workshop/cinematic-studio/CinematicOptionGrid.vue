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
  <div class="grid grid-cols-2 gap-x-3 gap-y-5">
    <button
      v-for="option in group.options"
      :key="option.id"
      type="button"
      role="radio"
      :aria-checked="selected === option.id"
      class="group flex flex-col gap-2 text-left"
      @click="emit('choose', option.id)"
    >
      <span
        :class="
          cn(
            'relative flex aspect-8/5 w-full overflow-hidden rounded-xl bg-transparency-white-t4 ring-1 ring-transparency-white-t8 transition-shadow group-hover:ring-transparency-white-t20',
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
        <template v-else>
          <span
            v-for="(color, index) in option.palette"
            :key="index"
            class="h-full flex-1"
            :style="{ backgroundColor: color }"
          />
        </template>
      </span>
      <span class="text-sm font-semibold text-primary-warm-white">
        {{ tc(option.label, locale) }}
      </span>
    </button>
  </div>
</template>
