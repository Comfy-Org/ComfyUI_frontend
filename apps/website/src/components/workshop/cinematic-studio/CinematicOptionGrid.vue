<script setup lang="ts">
import { Sparkles } from '@lucide/vue'

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
  <div
    role="radiogroup"
    :aria-label="tc(group.title, locale)"
    class="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4"
  >
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
          <Sparkles class="size-5" aria-hidden="true" />
        </span>
        <template v-else>
          <span
            v-for="(color, index) in option.palette"
            :key="index"
            class="h-full flex-1"
            :style="{ backgroundColor: color }"
          />
        </template>
      </span>
      <span
        class="truncate px-1 text-sm text-primary-comfy-canvas group-hover:text-primary-warm-white"
      >
        {{ tc(option.label, locale) }}
      </span>
    </button>
  </div>
</template>
