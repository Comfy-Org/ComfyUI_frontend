<script setup lang="ts">
import { ChevronRight, Video } from '@lucide/vue'
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
import CinematicDirectionThumb from './CinematicDirectionThumb.vue'
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

const camera = computed(() => {
  const [body, ...specs] = cameraGroups.map((group) =>
    directionOption(group.part, direction)
  )
  return {
    value: tc(body.label, locale),
    detail: specs
      .filter((option) => option.id !== 'auto')
      .map((option) => tc(option.label, locale))
      .join(' · ')
  }
})

const rows = computed(() =>
  [...lookGroups, gradeGroup].map((group) => {
    const option = directionOption(group.part, direction)
    return {
      key: group.part,
      title: tc(group.title, locale),
      value: tc(option.label, locale),
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
      :class="rowClass('camera')"
      @click="emit('open', 'camera')"
    >
      <span
        class="grid h-7 w-10 shrink-0 place-items-center"
        aria-hidden="true"
      >
        <Video class="size-5 text-primary-warm-white" />
      </span>
      <span class="w-14 shrink-0 text-xs text-primary-warm-gray">
        {{ tc('cinematic.section.camera', locale) }}
      </span>
      <span class="min-w-0 flex-1 truncate text-sm">
        <span class="font-semibold text-primary-warm-white">
          {{ camera.value }}
        </span>
        <span v-if="camera.detail" class="text-primary-warm-gray">
          · {{ camera.detail }}
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
