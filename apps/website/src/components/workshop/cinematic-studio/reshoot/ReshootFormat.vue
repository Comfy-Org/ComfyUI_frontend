<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { ChevronDown, Maximize, RectangleHorizontal } from '@lucide/vue'
import { computed } from 'vue'

import type {
  ReshootAspect,
  ReshootSize
} from '@/lib/workshop/cinematic-studio/reshoot'
import {
  RESHOOT_ASPECTS,
  RESHOOT_SIZES
} from '@/lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '@/i18n/translations'
import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const aspect = defineModel<ReshootAspect>('aspect', { required: true })
const size = defineModel<ReshootSize>('size', { required: true })

const aspectLabel = (id: ReshootAspect) =>
  id === 'source' ? t('reshoot.aspect.source') : id
const aspectOptions = computed(() =>
  RESHOOT_ASPECTS.map((id) => ({ id, label: aspectLabel(id) }))
)
const sizeOptions = computed(() =>
  RESHOOT_SIZES.map((id) => ({
    id,
    label: id,
    meta: t(`reshoot.size.${id}`)
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
</script>

<template>
  <div
    role="group"
    :aria-label="t('reshoot.section.format')"
    class="grid grid-cols-2 gap-2"
  >
    <CinematicMenu
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="t('reshoot.aspect.label')"
      tooltip
      :trigger-class="FORMAT_TRIGGER_CLASS"
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
      :heading="t('reshoot.size.label')"
      tooltip
      :trigger-class="FORMAT_TRIGGER_CLASS"
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left">{{ size }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
  </div>
</template>
