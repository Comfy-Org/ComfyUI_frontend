<script setup lang="ts">
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

const {
  direction,
  open = false,
  locale = 'en'
} = defineProps<{
  direction: Direction
  open?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ open: [] }>()

const chips = computed(() =>
  [...lookGroups, gradeGroup].map((group) => {
    const option = directionOption(group.part, direction)
    return {
      part: group.part,
      title: tc(group.title, locale),
      label: tc(option.label, locale),
      preview: option.preview,
      palette: option.palette
    }
  })
)

const looks = computed(() =>
  chips.value.filter((chip) => chip.part !== 'grade')
)
const palette = computed(
  () => chips.value.find((chip) => chip.part === 'grade')?.palette
)
const summary = computed(() =>
  looks.value.map((chip) => chip.label).join(' · ')
)
const description = computed(() =>
  chips.value.map((chip) => `${chip.title}: ${chip.label}`).join(', ')
)
</script>

<template>
  <button
    type="button"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-label="`${tc('cinematic.section.direction', locale)}: ${description}`"
    :title="description"
    :class="
      cn(
        'flex h-9 max-w-md min-w-0 shrink-0 items-center gap-2.5 rounded-xl pr-3 pl-1.5 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
        open &&
          'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
      )
    "
    @click="emit('open')"
  >
    <span class="flex shrink-0 items-center" aria-hidden="true">
      <template v-for="chip in looks" :key="chip.part">
        <img
          v-if="chip.preview"
          :src="chip.preview"
          alt=""
          class="-ml-2 size-6 rounded-md object-cover ring-2 ring-primary-comfy-ink-light first:ml-0"
        />
        <span
          v-else
          class="-ml-2 size-6 rounded-md bg-transparency-white-t8 ring-2 ring-primary-comfy-ink-light first:ml-0"
        />
      </template>
      <span
        v-if="palette"
        class="-ml-2 flex size-6 overflow-hidden rounded-full ring-2 ring-primary-comfy-ink-light"
      >
        <span
          v-for="(color, index) in palette"
          :key="index"
          class="h-full flex-1"
          :style="{ backgroundColor: color }"
        />
      </span>
    </span>
    <span class="hidden truncate min-[88rem]:block">{{ summary }}</span>
  </button>
</template>
