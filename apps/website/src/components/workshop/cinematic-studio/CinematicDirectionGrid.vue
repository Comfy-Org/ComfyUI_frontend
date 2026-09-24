<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Direction } from '../../../lib/workshop/cinematic-studio/catalog'
import {
  directionOption,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { PickerKey } from './picker-key'

const {
  direction,
  openPicker,
  locale = 'en'
} = defineProps<{
  direction: Direction
  openPicker?: PickerKey
  locale?: Locale
}>()

const emit = defineEmits<{ open: [key: PickerKey] }>()

const tiles = computed(() =>
  lookGroups.map((group) => ({
    key: group.part,
    title: tc(group.title, locale),
    option: directionOption(group.part, direction)
  }))
)
const grade = computed(() => directionOption('grade', direction))
</script>

<template>
  <div class="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-2">
    <button
      v-for="tile in tiles"
      :key="tile.key"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPicker === tile.key"
      :class="
        cn(
          'group relative flex aspect-8/5 flex-col justify-end overflow-hidden rounded-xl bg-transparency-white-t4 p-2.5 text-left ring-1 ring-transparency-white-t20 ring-inset hover:ring-primary-warm-white/50',
          openPicker === tile.key && 'ring-2 ring-primary-warm-white'
        )
      "
      @click="emit('open', tile.key)"
    >
      <img
        v-if="tile.option.preview"
        :src="tile.option.preview"
        alt=""
        class="absolute inset-0 size-full object-cover opacity-75 transition-opacity group-hover:opacity-100"
      />
      <span
        class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/30 to-transparent"
        aria-hidden="true"
      />
      <span
        class="relative text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
      >
        {{ tile.title }}
      </span>
      <span
        class="relative truncate text-sm font-semibold text-primary-warm-white"
      >
        {{ tc(tile.option.label, locale) }}
      </span>
    </button>
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPicker === 'grade'"
      :class="
        cn(
          'col-span-2 flex items-center gap-3 rounded-xl bg-transparency-white-t4 p-2 text-left ring-1 ring-transparency-white-t20 ring-inset hover:ring-primary-warm-white/50 md:col-span-4 lg:col-span-2',
          openPicker === 'grade' && 'ring-2 ring-primary-warm-white'
        )
      "
      @click="emit('open', 'grade')"
    >
      <span class="flex h-8 w-24 shrink-0 overflow-hidden rounded-lg">
        <span
          v-for="(color, index) in grade.palette"
          :key="index"
          class="h-full flex-1"
          :style="{ backgroundColor: color }"
        />
      </span>
      <span class="flex min-w-0 flex-1 flex-col">
        <span
          class="text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
        >
          {{ tc(gradeGroup.title, locale) }}
        </span>
        <span class="truncate text-sm font-semibold text-primary-warm-white">
          {{ tc(grade.label, locale) }}
        </span>
      </span>
      <ChevronRight class="size-4 text-primary-warm-gray" aria-hidden="true" />
    </button>
  </div>
</template>
