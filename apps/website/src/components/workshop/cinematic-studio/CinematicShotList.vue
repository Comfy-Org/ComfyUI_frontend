<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Direction } from '../../../lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  directionOption,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { shownOption } from '../../../lib/workshop/cinematic-studio/grade-image'
import CinematicDirectionThumb from './CinematicDirectionThumb.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import type { PickerKey } from './picker-key'

const {
  direction,
  openPicker,
  colors,
  locale = 'en'
} = defineProps<{
  direction: Direction
  colors?: readonly string[]
  openPicker?: PickerKey
  locale?: Locale
}>()

const emit = defineEmits<{ open: [key: PickerKey] }>()

const camera = computed(() => {
  const [body, ...specs] = cameraGroups.map((group) =>
    directionOption(group.part, direction)
  )
  return {
    value: tc(body.label, locale),
    specs: specs
      .filter((option) => option.id !== 'auto')
      .map((option) => tc(option.label, locale))
  }
})

const rows = computed(() =>
  [...lookGroups, gradeGroup].map((group) => {
    const { label, option } = shownOption(group.part, direction, colors)
    return {
      key: group.part,
      title: tc(group.title, locale),
      value: tc(label, locale),
      option
    }
  })
)

const rowClass = (key: PickerKey) =>
  cn(
    'flex h-12 w-full items-center gap-3 px-3 text-left transition-colors hover:bg-transparency-white-t4',
    openPicker === key && 'bg-transparency-white-t8'
  )
</script>

<template>
  <div
    class="flex flex-col divide-y divide-transparency-white-t8 overflow-hidden rounded-2xl border border-transparency-white-t8"
  >
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPicker === 'camera'"
      :class="
        cn(rowClass('camera'), 'max-sm:h-auto max-sm:min-h-12 max-sm:py-2')
      "
      @click="emit('open', 'camera')"
    >
      <CinematicOptionIcon
        part="body"
        :option="direction.body"
        class="h-7 w-10 shrink-0"
        aria-hidden="true"
      />
      <span class="w-14 shrink-0 text-xs text-primary-warm-gray">
        {{ tc('cinematic.section.camera', locale) }}
      </span>
      <span
        class="flex min-w-0 flex-1 items-center gap-2 max-sm:flex-col max-sm:items-start max-sm:gap-1"
      >
        <span
          class="max-w-full min-w-0 truncate text-sm font-semibold text-primary-warm-white sm:flex-1"
        >
          {{ camera.value }}
        </span>
        <span
          v-if="camera.specs.length"
          class="flex max-w-full flex-wrap items-center gap-1 sm:shrink-0"
          data-testid="camera-specs"
        >
          <span
            v-for="spec in camera.specs"
            :key="spec"
            class="rounded-md bg-transparency-white-t8 px-1.5 py-0.5 text-xs text-primary-comfy-canvas tabular-nums"
          >
            {{ spec }}
          </span>
        </span>
      </span>
      <ChevronRight
        class="size-4 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
    <button
      v-for="row in rows"
      :key="row.key"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPicker === row.key"
      :class="rowClass(row.key)"
      @click="emit('open', row.key)"
    >
      <CinematicDirectionThumb :option="row.option" class="h-7 w-10" />
      <span class="w-14 shrink-0 text-xs text-primary-warm-gray">
        {{ row.title }}
      </span>
      <span
        class="min-w-0 flex-1 truncate text-sm font-semibold text-primary-warm-white"
      >
        {{ row.value }}
      </span>
      <ChevronRight
        class="size-4 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
