<script setup lang="ts">
import { computed } from 'vue'

import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Reel } from '../../../lib/workshop/cinematic-studio/reel'
import {
  selectedTake,
  takesOfShot
} from '../../../lib/workshop/cinematic-studio/reel'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicFirstRun from './CinematicFirstRun.vue'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeActions from './CinematicTakeActions.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  models,
  starter,
  locale = 'en'
} = defineProps<{
  reel: Reel
  models: readonly CinematicModel[]
  starter?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  start: [shot: StarterShot]
  again: []
  reference: [url: string, name: string]
}>()

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
const modelName = computed(
  () =>
    models.find((model) => model.slug === current.value?.modelSlug)?.name ?? ''
)
</script>

<template>
  <section
    class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-4 py-6 sm:px-8 lg:px-14"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <template v-if="current">
      <h1 class="sr-only">{{ tc('cinematic.title', locale) }}</h1>
      <CinematicTakeFrame :current :locale />
      <div
        class="flex w-full max-w-5xl flex-wrap items-center justify-between gap-3"
      >
        <CinematicTakeBar
          :current
          :siblings
          :model-name="modelName"
          :locale
          @select="emit('select', $event)"
        />
        <CinematicTakeActions
          v-if="current.status === 'done'"
          :take="current"
          :locale
          @again="emit('again')"
          @reference="(url, name) => emit('reference', url, name)"
        />
        <CinematicSequence
          :takes="reel.takes"
          :current-id="current.id"
          :locale
          @select="emit('select', $event)"
        />
      </div>
    </template>
    <CinematicFirstRun
      v-else
      :selected="starter"
      :locale
      @start="emit('start', $event)"
    />
  </section>
</template>
