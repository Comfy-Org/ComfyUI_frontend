<script setup lang="ts">
import { ChevronDown, SquareDashed } from '@lucide/vue'
import { computed } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'
import RelightSeed from './RelightSeed.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight

const areas = computed(() => [
  { id: 'whole', label: lc('relight.generation.whole', locale) },
  ...(setup.value.masks.length
    ? [{ id: 'masked', label: lc('relight.generation.masked', locale) }]
    : [])
])
const area = computed({
  get: () => setup.value.generation.area,
  set: (id: string) => {
    if (id === 'whole' || id === 'masked')
      relight.updateGeneration({ area: id })
  }
})
const areaLabel = computed(
  () => areas.value.find((option) => option.id === area.value)?.label
)
</script>

<template>
  <div class="grid grid-cols-2 gap-2">
    <CinematicMenu
      v-model="area"
      :options="areas"
      :heading="lc('relight.generation.area', locale)"
      side="top"
      tooltip
      :trigger-class="FORMAT_TRIGGER_CLASS"
    >
      <SquareDashed
        class="size-3.5 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate text-left">{{ areaLabel }}</span>
      <ChevronDown
        class="size-3.5 shrink-0 text-primary-warm-gray"
        aria-hidden="true"
      />
    </CinematicMenu>
    <RelightSeed :relight :locale />
  </div>
</template>
