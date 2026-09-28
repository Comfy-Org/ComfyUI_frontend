<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  LookPart
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  directionOption,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'

const {
  direction,
  open,
  locale = 'en'
} = defineProps<{
  direction: Direction
  open?: string
  locale?: Locale
}>()

const emit = defineEmits<{ open: [part: LookPart | 'grade'] }>()

const segments = computed(() =>
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
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.section.direction', locale)"
    class="flex h-9 shrink-0 items-center overflow-hidden rounded-xl ring-1 ring-transparency-white-t8 ring-inset"
  >
    <template v-for="(segment, index) in segments" :key="segment.part">
      <span
        v-if="index > 0"
        class="h-4 w-px shrink-0 bg-transparency-white-t8"
        aria-hidden="true"
      />
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="open === segment.part"
        :aria-label="`${segment.title}: ${segment.label}`"
        :title="`${segment.title}: ${segment.label}`"
        :class="
          cn(
            'grid h-full place-items-center px-1.5 transition-colors hover:bg-transparency-white-t4',
            open === segment.part && 'bg-transparency-white-t8'
          )
        "
        @click="emit('open', segment.part)"
      >
        <img
          v-if="segment.preview"
          :src="segment.preview"
          alt=""
          class="size-6 shrink-0 rounded-md object-cover"
        />
        <span
          v-else-if="segment.palette"
          class="flex size-6 shrink-0 overflow-hidden rounded-md"
          aria-hidden="true"
        >
          <span
            v-for="(color, stripe) in segment.palette"
            :key="stripe"
            class="h-full flex-1"
            :style="{ backgroundColor: color }"
          />
        </span>
        <span
          v-else
          class="size-6 shrink-0 rounded-md bg-transparency-white-t8"
          aria-hidden="true"
        />
      </button>
    </template>
  </div>
</template>
