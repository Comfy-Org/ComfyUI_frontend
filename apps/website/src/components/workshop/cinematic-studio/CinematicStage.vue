<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

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
import CinematicCreditSummary from './CinematicCreditSummary.vue'
import CinematicFirstRun from './CinematicFirstRun.vue'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeActions from './CinematicTakeActions.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  models,
  starter,
  memberWorkspace,
  locale = 'en'
} = defineProps<{
  reel: Reel
  models: readonly CinematicModel[]
  /** Whether a still can be animated into a clip. */
  canAnimate?: boolean
  /** Whether a still can become the next still's character reference. */
  canReference?: boolean
  starter?: string
  memberWorkspace?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  start: [shot: StarterShot]
  again: []
  retry: [...ids: string[]]
  reference: [url: string, name: string]
  animate: [url: string, name: string]
  switchModel: [slug: string]
  editScene: []
}>()

const FRAME_HEIGHT = '44svh'

const current = computed(() => selectedTake(reel))
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
// The column keeps the frame's width until the finished media has loaded.
const frameLoaded = ref(false)
const modelName = computed(
  () =>
    models.find((model) => model.slug === current.value?.modelSlug)?.name ?? ''
)
const otherModel = computed(() => {
  const mode = models.find(
    (model) => model.slug === current.value?.modelSlug
  )?.mode
  // A failed clip is retried on another video model, a still on an image one.
  return models.find(
    (model) => model.slug !== current.value?.modelSlug && model.mode === mode
  )
})
</script>

<template>
  <section
    class="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 px-4 pt-6 pb-10 sm:px-8 lg:px-14"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <template v-if="current">
      <h1 class="sr-only">{{ tc('cinematic.title', locale) }}</h1>
      <div
        data-testid="cinematic-take-column"
        class="flex max-w-5xl flex-col gap-3"
        :style="{
          width:
            current.status === 'done' && frameLoaded
              ? 'fit-content'
              : framedStyle(current.aspect, FRAME_HEIGHT).width
        }"
      >
        <CinematicTakeFrame
          v-model:loaded="frameLoaded"
          :current
          :other-model="otherModel"
          :member-workspace="memberWorkspace"
          :height="FRAME_HEIGHT"
          :locale
          @retry="emit('retry', current.id)"
          @switch-model="emit('switchModel', $event)"
          @edit-scene="emit('editScene')"
        >
          <!-- A clip's own play bar sits at the bottom, so its take details
               sit at the top instead of covering the controls. -->
          <div
            v-if="current.status === 'done'"
            data-testid="cinematic-take-overlay"
            :class="
              cn(
                'absolute inset-x-0 flex flex-wrap justify-between gap-3 from-primary-comfy-ink/90 via-primary-comfy-ink/50 to-transparent p-4 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100',
                current.output.kind === 'video'
                  ? 'top-0 items-start bg-linear-to-b pb-16'
                  : 'bottom-0 items-end bg-linear-to-t pt-16'
              )
            "
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
              :can-animate="canAnimate"
              :can-reference="canReference"
              :locale
              @again="emit('again')"
              @reference="(url, name) => emit('reference', url, name)"
              @animate="(url, name) => emit('animate', url, name)"
            />
          </div>
        </CinematicTakeFrame>
        <CinematicCreditSummary
          :takes="siblings"
          :member-workspace="memberWorkspace"
          :locale
          @retry="emit('retry', ...$event)"
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
