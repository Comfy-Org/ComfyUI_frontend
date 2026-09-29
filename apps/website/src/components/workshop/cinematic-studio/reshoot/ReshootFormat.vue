<script setup lang="ts">
import { ChevronDown, Maximize, RectangleHorizontal } from '@lucide/vue'
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
const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    aspect.value =
      RESHOOT_ASPECTS.find((option) => option === id) ?? aspect.value
  }
})
const sizeValue = computed({
  get: () => size.value,
  set: (id: string) => {
    size.value = RESHOOT_SIZES.find((option) => option === id) ?? size.value
  }
})

const triggerClass =
  'h-10 w-full gap-2 border border-transparency-white-t8 px-3 text-sm text-primary-warm-white hover:border-transparency-white-t20'
</script>

<template>
  <div
    role="group"
    :aria-label="rc('reshoot.section.format', locale)"
    class="grid grid-cols-2 gap-2"
  >
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="rc('reshoot.aspect', locale)"
      tooltip
      :trigger-class="triggerClass"
    >
      <RectangleHorizontal
        class="size-3.5 text-primary-warm-gray"
        aria-hidden="true"
      />
      <span class="flex-1 truncate text-left">{{ aspectLabel(aspect) }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicMenu
      v-model="sizeValue"
      :options="sizeOptions"
      :heading="rc('reshoot.size', locale)"
      tooltip
      :trigger-class="triggerClass"
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left">{{ size }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
  </div>
</template>
