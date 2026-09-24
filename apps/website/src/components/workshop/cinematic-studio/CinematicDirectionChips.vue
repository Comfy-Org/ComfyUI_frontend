<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  DirectionPart
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
  open = false,
  locale = 'en'
} = defineProps<{
  direction: Direction
  open?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{ open: [part: DirectionPart] }>()

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
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.section.direction', locale)"
    :class="
      cn(
        'flex h-9 shrink-0 items-center rounded-xl p-0.5 ring-1 ring-transparency-white-t8 ring-inset',
        open && 'ring-transparency-white-t20'
      )
    "
  >
    <button
      v-for="chip in chips"
      :key="chip.part"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="`${chip.title}: ${chip.label}`"
      :title="`${chip.title}: ${chip.label}`"
      class="flex h-8 items-center gap-2 rounded-[10px] px-1 text-[13px] whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white min-[88rem]:pr-2.5"
      @click="emit('open', chip.part)"
    >
      <img
        v-if="chip.preview"
        :src="chip.preview"
        alt=""
        class="size-6 shrink-0 rounded-md object-cover"
      />
      <span
        v-else-if="chip.palette"
        class="flex size-6 shrink-0 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <span
          v-for="(color, index) in chip.palette"
          :key="index"
          class="h-full flex-1"
          :style="{ backgroundColor: color }"
        />
      </span>
      <span
        v-else
        class="size-6 shrink-0 rounded-md border border-dashed border-transparency-white-t20"
        aria-hidden="true"
      />
      <span
        v-if="chip.part !== 'grade'"
        class="hidden max-w-26 truncate min-[88rem]:block"
      >
        {{ chip.label }}
      </span>
    </button>
  </div>
</template>
