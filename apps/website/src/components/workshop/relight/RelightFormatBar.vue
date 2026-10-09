<script setup lang="ts">
import { ChevronDown, Dices, SquareDashed } from '@lucide/vue'
import { computed, useId } from 'vue'

import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import EditorIconButton from '@/components/workshop/app-editor/EditorIconButton.vue'
import type { Relight } from '@/composables/useRelight'
import type { Locale } from '@/i18n/translations'
import { lc } from '@/lib/workshop/relight/copy'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight
const seedId = useId()

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

function onSeed(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  const seed = Number.parseFloat(event.target.value)
  if (Number.isFinite(seed))
    relight.updateGeneration({ seed: Math.max(0, Math.floor(seed)) }, 'seed')
}

function shuffle() {
  relight.updateGeneration(
    { seed: Math.floor(Math.random() * 1_000_000_000) },
    'seed'
  )
}
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
    <div
      class="flex h-10 items-center gap-1 rounded-xl border border-transparency-white-t8 pr-1 pl-3 hover:border-transparency-white-t20"
    >
      <label :for="seedId" class="sr-only">
        {{ lc('relight.generation.seed', locale) }}
      </label>
      <input
        :id="seedId"
        :value="setup.generation.seed"
        type="number"
        min="0"
        step="1"
        class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm text-primary-warm-white tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50"
        @change="onSeed"
      />
      <EditorIconButton
        :icon="Dices"
        :label="lc('relight.generation.shuffle', locale)"
        @click="shuffle"
      />
    </div>
  </div>
</template>
