<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import type { Relight } from '../../../composables/useRelight'
import type { Locale } from '../../../i18n/translations'
import { lc } from '../../../lib/workshop/relight/copy'
import EditorNumberField from '../app-editor/EditorNumberField.vue'
import EditorSelect from '../app-editor/EditorSelect.vue'
import EditorSlider from '../app-editor/EditorSlider.vue'
import EditorTextArea from '../app-editor/EditorTextArea.vue'

const { relight, locale = 'en' } = defineProps<{
  relight: Relight
  locale?: Locale
}>()

const { setup } = relight
const areas = computed(() => [
  { id: 'whole' as const, label: lc('relight.generation.whole', locale) },
  {
    id: 'masked' as const,
    label: lc('relight.generation.masked', locale),
    disabled: !setup.value.masks.length
  }
])
</script>

<template>
  <EditorTextArea
    :model-value="setup.generation.prompt"
    :label="lc('relight.generation.prompt', locale)"
    :placeholder="lc('relight.generation.promptPlaceholder', locale)"
    @update:model-value="
      (prompt) => relight.updateGeneration({ prompt }, 'prompt')
    "
  />
  <EditorSlider
    wide
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
