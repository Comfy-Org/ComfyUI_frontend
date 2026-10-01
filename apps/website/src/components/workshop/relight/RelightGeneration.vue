<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorSelect from '../app-editor/EditorSelect.vue'
import EditorSlider from '../app-editor/EditorSlider.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight
const promptId = useId()
const seedId = useId()
const areas = computed(() => [
  { id: 'whole' as const, label: lc('relight.generation.whole', locale) },
  {
    id: 'masked' as const,
    label: lc('relight.generation.masked', locale),
    disabled: !setup.value.masks.length
  }
])
const field =
  'rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40'

function onPrompt(event: Event) {
  if (event.target instanceof HTMLTextAreaElement)
    relight.updateGeneration({ prompt: event.target.value }, 'prompt')
}

function onSeed(event: Event) {
  const seed =
    event.target instanceof HTMLInputElement
      ? Math.round(Number(event.target.value))
      : NaN
  if (Number.isFinite(seed) && seed >= 0)
    relight.updateGeneration({ seed }, 'seed')
}
</script>

<template>
  <div class="flex flex-col gap-1.5 px-1">
    <label :for="promptId" class="text-xs text-primary-warm-gray">{{
      lc('relight.generation.prompt', locale)
    }}</label>
    <textarea
      :id="promptId"
      :value="setup.generation.prompt"
      rows="3"
      :placeholder="lc('relight.generation.promptPlaceholder', locale)"
      :class="cn('resize-none py-2', field)"
      @input="onPrompt"
    />
  </div>
  <EditorSlider
    :model-value="setup.generation.strength"
    :label="lc('relight.generation.strength', locale)"
    unit="%"
    @update:model-value="
      (strength) => relight.updateGeneration({ strength }, 'strength')
    "
  />
  <details class="group rounded-xl border border-transparency-white-t8">
    <summary
      class="flex h-9 cursor-pointer list-none items-center justify-between px-3 text-[11px] font-medium tracking-wider text-primary-warm-gray uppercase focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
    >
      {{ lc('relight.generation.options', locale) }}
      <ChevronDown
        class="size-3 transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="flex flex-col gap-3 px-2 pb-3">
      <EditorSelect
        :model-value="setup.generation.area"
        :label="lc('relight.generation.area', locale)"
        :options="areas"
        @update:model-value="(area) => relight.updateGeneration({ area })"
      />
      <div class="flex items-center gap-2 px-1">
        <label :for="seedId" class="shrink-0 text-xs text-primary-warm-gray">{{
          lc('relight.generation.seed', locale)
        }}</label>
        <input
          :id="seedId"
          :value="setup.generation.seed"
          type="number"
          min="0"
          step="1"
          :class="cn('h-8 min-w-0 flex-1 font-mono tabular-nums', field)"
          @change="onSeed"
        />
      </div>
    </div>
  </details>
</template>
