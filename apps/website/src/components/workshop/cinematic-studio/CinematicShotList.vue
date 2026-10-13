<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ChevronRight } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Direction } from '@/lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  directionOption,
  gradeGroup,
  lookGroups
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { shownOption } from '@/lib/workshop/cinematic-studio/grade-image'
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
const { t } = translationsFor(locale)

const emit = defineEmits<{ open: [key: PickerKey] }>()

const camera = computed(() => {
  const [body, ...specs] = cameraGroups.map((group) =>
    directionOption(group.part, direction)
  )
  return {
    value: t(body.label),
    specs: specs
      .filter((option) => option.id !== 'auto')
      .map((option) => t(option.label))
  }
})

const rows = computed(() =>
  [...lookGroups, gradeGroup].map((group) => {
    const { label, option } = shownOption(group.part, direction, colors)
    return {
      key: group.part,
      title: t(group.title),
      value: t(label),
      option
    }
  })
)

const rowClass = (key: PickerKey) =>
  cn(
    'flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-transparency-white-t4',
    openPicker === key && 'bg-transparency-white-t8'
  )
</script>

<template>
  <div
    class="flex flex-col gap-0.5 overflow-hidden rounded-2xl border border-transparency-white-t8 p-1"
  >
    <button
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="openPicker === 'camera'"
      :class="rowClass('camera')"
      @click="emit('open', 'camera')"
    >
      <CinematicOptionIcon
        part="body"
        :option="direction.body"
        class="h-9 w-12 shrink-0"
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-xs text-primary-warm-gray">
          {{ t('cinematic.section.camera') }}
        </span>
        <span class="text-sm/snug font-semibold text-primary-warm-white">
          {{ camera.value }}
        </span>
        <span
          v-if="camera.specs.length"
          class="mt-0.5 flex flex-wrap items-center gap-1"
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
      <CinematicDirectionThumb :option="row.option" class="h-9 w-12" />
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="text-xs text-primary-warm-gray">{{ row.title }}</span>
        <span class="text-sm/snug font-semibold text-primary-warm-white">
          {{ row.value }}
        </span>
      </span>
      <ChevronRight
        class="size-4 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
