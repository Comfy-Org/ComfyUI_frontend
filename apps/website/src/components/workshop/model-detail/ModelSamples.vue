<script setup lang="ts">
import { computed } from 'vue'

import type { WorkshopModelDetail } from '@/config/models-catalogue'
import type { PlaygroundExample } from '@/config/workshop-playground'
import type { RunOutput, RunState } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import ExamplesTab from '@/components/workshop/ExamplesTab.vue'
import PlaygroundOutput from '@/components/workshop/PlaygroundOutput.vue'

const {
  state,
  now,
  examples,
  model,
  activeId,
  locale = 'en'
} = defineProps<{
  state: RunState
  now: number
  examples: readonly PlaygroundExample[]
  model: Pick<WorkshopModelDetail, 'name' | 'modality'>
  activeId?: string
  locale?: Locale
}>()
const revealed = defineModel<boolean>('revealed', { default: false })
const emit = defineEmits<{
  open: [example: PlaygroundExample]
  download: [kind: RunOutput['kind']]
}>()

const samples = computed(() =>
  examples.map((example) => ({ ...example, sampleOnly: true }))
)
</script>

<template>
  <section
    id="samples"
    class="flex flex-col gap-6"
    data-testid="samples-section"
  >
    <PlaygroundOutput
      v-model:revealed="revealed"
      :state
      :now
      :modality="model.modality"
      :locale
      class="lg:w-7/12"
      @download="emit('download', $event)"
    />
    <ExamplesTab
      :examples="samples"
      :gallery-label="model.name"
      :active-id
      :locale
      @open="emit('open', $event)"
    />
  </section>
</template>
