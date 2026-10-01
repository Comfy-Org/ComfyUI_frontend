<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed, useId } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorNumberField from '../app-editor/EditorNumberField.vue'
import EditorSelect from '../app-editor/EditorSelect.vue'
import EditorSlider from '../app-editor/EditorSlider.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight
const promptId = useId()
const areas = computed(() => [
  { id: 'whole' as const, label: lc('relight.generation.whole', locale) },
  {
    id: 'masked' as const,
    label: lc('relight.generation.masked', locale),
    disabled: !setup.value.masks.length
  }
])
const field =
  'rounded-lg bg-transparency-white-t4 px-2.5 text-xs text-primary-warm-white placeholder:text-primary-warm-gray/60 focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none disabled:opacity-40'

function onPrompt(event: Event) {
  if (event.target instanceof HTMLTextAreaElement)
    relight.updateGeneration({ prompt: event.target.value }, 'prompt')
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
  <details class="group">
    <summary
      class="flex h-8 cursor-pointer list-none items-center justify-between rounded-md px-1 text-xs text-primary-warm-gray transition hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
    >
      {{ lc('relight.generation.options', locale) }}
      <ChevronDown
        class="size-3 transition-transform group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="flex flex-col gap-2 pt-1">
      <EditorSelect
        :model-value="setup.generation.area"
        :label="lc('relight.generation.area', locale)"
        :options="areas"
        @update:model-value="(area) => relight.updateGeneration({ area })"
      />
      <EditorNumberField
        :model-value="setup.generation.seed"
        :label="lc('relight.generation.seed', locale)"
        @update:model-value="
          (seed) => relight.updateGeneration({ seed }, 'seed')
        "
      />
    </div>
  </details>
</template>
