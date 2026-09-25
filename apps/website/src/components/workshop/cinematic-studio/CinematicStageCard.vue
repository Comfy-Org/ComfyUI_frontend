<script setup lang="ts">
import { computed } from 'vue'

import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Reel } from '../../../lib/workshop/cinematic-studio/reel'
import {
  selectedTake,
  takesOfShot
} from '../../../lib/workshop/cinematic-studio/reel'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'
import CinematicSequence from './CinematicSequence.vue'
import CinematicTakeActions from './CinematicTakeActions.vue'
import CinematicTakeBar from './CinematicTakeBar.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const {
  reel,
  aspect,
  models,
  locale = 'en'
} = defineProps<{
  reel: Reel
  aspect: AspectRatio
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const emit = defineEmits<{
  select: [id: string]
  again: []
  reference: [url: string, name: string]
  animate: [url: string, name: string]
  edit: [url: string, name: string]
  switchModel: [slug: string]
  editScene: []
}>()

const current = computed(() => selectedTake(reel))
const modelName = computed(
  () =>
    models.find((model) => model.slug === current.value?.modelSlug)?.name ?? ''
)
const siblings = computed(() =>
  current.value ? takesOfShot(reel, current.value.shot) : []
)
const otherModel = computed(() => {
  const selected = models.find(
    (model) => model.slug === current.value?.modelSlug
  )
  return models.find(
    (model) =>
      model.slug !== selected?.slug &&
      (model.mode ?? 'image') === (selected?.mode ?? 'image') &&
      model.video?.firstFrame === selected?.video?.firstFrame
  )
})
</script>

<template>
  <section
    class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    :aria-label="tc('cinematic.stage.label', locale)"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.output.title', locale) }}
    </header>
    <div
      class="flex min-h-72 flex-col items-center justify-center gap-4 p-4 sm:p-6 lg:min-h-112"
    >
      <template v-if="current">
        <CinematicTakeFrame
          :current
          :locale
          :other-model="otherModel"
          @again="emit('again')"
          @switch-model="emit('switchModel', $event)"
          @edit-scene="emit('editScene')"
        />
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
          @animate="(url, name) => emit('animate', url, name)"
          @edit="(url, name) => emit('edit', url, name)"
        />
      </template>

      <div
        v-else
        class="flex max-w-3xl flex-col items-center justify-center gap-2 rounded-md bg-transparency-white-t4 p-6 text-center transition-[aspect-ratio] duration-300"
        :style="framedStyle(aspect, '60vh')"
        data-testid="cinematic-frame-preview"
      >
        <span
          class="text-xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          {{ aspect }}
        </span>
        <p class="text-base font-semibold text-primary-warm-white">
          {{ tc('cinematic.stage.emptyTitle', locale) }}
        </p>
        <p class="text-sm text-primary-warm-gray">
          {{ tc('cinematic.stage.emptyBody', locale) }}
        </p>
      </div>
    </div>
    <CinematicSequence
      v-if="reel.takes.length"
      :takes="reel.takes"
      :current-id="current?.id"
      :locale
      @select="emit('select', $event)"
    />
  </section>
</template>
