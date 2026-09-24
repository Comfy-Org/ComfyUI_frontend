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
import { framedStyle } from './aspect-style'
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
  switchModel: [slug: string]
  editScene: []
}>()

const FRAME_HEIGHT = '44svh'

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
const modelName = computed(
  () =>
    models.find((model) => model.slug === current.value?.modelSlug)?.name ?? ''
)
const otherModel = computed(() =>
  models.find((model) => model.slug !== current.value?.modelSlug)
)
</script>

<template>
  <section
    class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-4 pt-6 pb-10 sm:px-8 lg:px-14"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <template v-if="current">
      <h1 class="sr-only">{{ tc('cinematic.title', locale) }}</h1>
      <div
        class="flex max-w-5xl flex-col gap-3"
        :style="{
          width:
            current.status === 'done'
              ? 'fit-content'
              : framedStyle(current.aspect, FRAME_HEIGHT).width
        }"
      >
        <CinematicTakeFrame
          :current
          :other-model="otherModel"
          :height="FRAME_HEIGHT"
          :locale
          @again="emit('again')"
          @switch-model="emit('switchModel', $event)"
          @edit-scene="emit('editScene')"
        >
          <div
            v-if="current.status === 'done'"
            class="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-linear-to-t from-primary-comfy-ink/90 via-primary-comfy-ink/50 to-transparent p-4 pt-16 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
          >
            <CinematicTakeBar
              :current
              :siblings
              :model-name="modelName"
              :locale
              @select="emit('select', $event)"
            />
            <CinematicTakeActions
              :take="current"
              :locale
              @again="emit('again')"
              @reference="(url, name) => emit('reference', url, name)"
            />
          </div>
        </CinematicTakeFrame>
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
