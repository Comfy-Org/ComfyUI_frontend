<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import type {
  ReshootAspect,
  ReshootSize
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_ASPECTS,
  RESHOOT_SIZES
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicMenu from '../CinematicMenu.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })

const aspectLabel = (id: ReshootAspect) =>
  id === 'source' ? rc('reshoot.aspect.source', locale) : id
const aspectOptions = computed(() =>
  RESHOOT_ASPECTS.map((id) => ({ id, label: aspectLabel(id) }))
)
const sizeOptions = computed(() =>
  RESHOOT_SIZES.map((id) => ({
    id,
    label: id,
    meta: rc(`reshoot.size.${id}`, locale)
  }))
)

function pick<T extends string>(options: readonly T[], id: string) {
  return options.find((option) => option === id)
}

const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    aspect.value = pick(RESHOOT_ASPECTS, id) ?? aspect.value
  }
})
const sizeValue = computed({
  get: () => size.value,
  set: (id: string) => {
    size.value = pick(RESHOOT_SIZES, id) ?? size.value
  }
})

const tileClass =
  'h-14 w-full justify-between gap-2 px-3.5 text-left ring-1 ring-transparency-white-t8 ring-inset transition-colors hover:bg-transparency-white-t4'
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="rc('reshoot.aspect', locale)"
      :trigger-class="tileClass"
    >
      <span class="flex min-w-0 flex-col">
        <span class="text-[11px] text-primary-warm-gray">
          {{ rc('reshoot.aspect', locale) }}
        </span>
        <span class="truncate text-[13px] text-primary-warm-white">
          {{ aspectLabel(aspect) }}
        </span>
      </span>
      <ChevronDown class="size-3.5 shrink-0 text-primary-warm-gray" />
    </CinematicMenu>
    <CinematicMenu
      v-model="sizeValue"
      :options="sizeOptions"
      :heading="rc('reshoot.size', locale)"
      :trigger-class="tileClass"
    >
      <span class="flex min-w-0 flex-col">
        <span class="text-[11px] text-primary-warm-gray">
          {{ rc('reshoot.size', locale) }}
        </span>
        <span class="truncate text-[13px] text-primary-warm-white">
          {{ size }}
          <span class="text-primary-warm-gray">
            · {{ rc(`reshoot.speed.${size}`, locale) }}
          </span>
        </span>
      </span>
      <ChevronDown class="size-3.5 shrink-0 text-primary-warm-gray" />
    </CinematicMenu>
  </div>
</template>
