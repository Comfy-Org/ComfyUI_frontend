<script setup lang="ts">
import { computed } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import type { AdjustTarget } from '@/lib/workshop/background-removal/contract'
import {
  ADJUST_FILTERS,
  ADJUST_TARGETS
} from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorSegmented from '@/components/workshop/app-editor/EditorSegmented.vue'
import EditorSlider from '@/components/workshop/app-editor/EditorSlider.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { setup } = cutout
const targets = ADJUST_TARGETS.map((id) => ({
  id,
  label: brc(`cutout.adjust.target.${id}`, locale)
}))
const target = computed({
  get: () => setup.value.adjust.target,
  set: (next: AdjustTarget) => cutout.updateAdjust({ target: next })
})
</script>

<template>
  <EditorSegmented
    v-model="target"
    :label="brc('cutout.adjust.target', locale)"
    :options="targets"
    fill
  />
  <div class="flex flex-col gap-1.5 px-1">
    <EditorSlider
      v-for="filter in ADJUST_FILTERS"
      :key="filter.id"
      :model-value="setup.adjust[filter.id]"
      :label="brc(`cutout.adjust.${filter.id}`, locale)"
      :max="filter.max"
      :unit="filter.unit"
      @update:model-value="
        (value) => cutout.updateAdjust({ [filter.id]: value }, filter.id)
      "
    />
  </div>
</template>
