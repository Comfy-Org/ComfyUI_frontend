<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  Direction,
  LookPart
} from '@/lib/workshop/cinematic-studio/catalog'
import { gradeGroup, lookGroups } from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { shownOption } from '@/lib/workshop/cinematic-studio/grade-image'
import CinematicDirectionThumb from './CinematicDirectionThumb.vue'
import CinematicTooltip from './CinematicTooltip.vue'

const {
  direction,
  open,
  colors,
  locale = 'en'
} = defineProps<{
  direction: Direction
  colors?: readonly string[]
  open?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ open: [part: LookPart | 'grade'] }>()

const segments = computed(() =>
  [...lookGroups, gradeGroup].map((group) => {
    const { label, option } = shownOption(group.part, direction, colors)
    return {
      part: group.part,
      title: t(group.title),
      label: t(label),
      option
    }
  })
)
</script>

<template>
  <div
    role="group"
    :aria-label="t('cinematic.section.direction')"
    class="flex h-9 shrink-0 items-center overflow-hidden rounded-xl ring-1 ring-transparency-white-t8 ring-inset"
  >
    <template v-for="(segment, index) in segments" :key="segment.part">
      <span
        v-if="index > 0"
        class="h-4 w-px shrink-0 bg-transparency-white-t8"
        aria-hidden="true"
      />
      <CinematicTooltip :text="`${segment.title}: ${segment.label}`">
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="open === segment.part"
          :aria-label="`${segment.title}: ${segment.label}`"
          :class="
            cn(
              'grid h-full place-items-center px-1.5 transition-colors hover:bg-transparency-white-t4',
              open === segment.part && 'bg-transparency-white-t8'
            )
          "
          @click="emit('open', segment.part)"
        >
          <CinematicDirectionThumb :option="segment.option" class="h-6 w-9" />
        </button>
      </CinematicTooltip>
    </template>
  </div>
</template>
