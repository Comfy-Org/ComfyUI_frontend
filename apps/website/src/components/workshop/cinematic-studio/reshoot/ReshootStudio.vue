<script setup lang="ts">
import { Clapperboard } from '@lucide/vue'

import { useReshootRun } from '../../../../composables/useReshootRun'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import AppsBackLink from '../AppsBackLink.vue'
import ReshootHeader from './ReshootHeader.vue'
import ReshootExamples from './ReshootExamples.vue'
import ReshootSide from './ReshootSide.vue'
import ReshootStage from './ReshootStage.vue'
import ReshootUpload from './ReshootUpload.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// The real run: depth analysis and takes are jobs on the CrossView
// deployment, and analysis waits for its button because it costs a run.
const demo = useReshootRun(locale)
const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  step,
  view,
  onKey,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current,
  rendering,
  frames,
  clipError,
  geometry,
  pose,
  status,
  error
} = demo
</script>

<template>
  <div
    class="mx-auto mb-12 flex w-full max-w-10xl flex-col gap-4 px-4 pt-6 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale />
    <ReshootHeader :locale class="mb-4" />
    <div class="grid items-start gap-6 lg:grid-cols-[27rem_minmax(0,1fr)]">
      <ReshootUpload v-if="!picked" :locale @pick="demo.pick" />
      <ReshootSide
        v-else
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:seed="seed"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:motion="motion"
        v-model:prompt="prompt"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :camera="view"
        :keys
        :depth
        :frames
        :clip-error="clipError"
        :error
        :rendering
        :locale
        @aim="demo.aim"
        @remove-key="demo.removeKey"
        @clear-keys="keys = []"
        @analyze="demo.analyze"
        @generate="demo.generate"
      />
      <div
        v-if="!picked"
        class="mx-auto flex aspect-video w-[min(100%,calc(52svh*16/9))] flex-col items-center justify-center gap-2 rounded-md bg-transparency-white-t4 px-6 text-center ring-1 ring-transparency-white-t8 lg:mt-2"
        data-testid="reshoot-empty"
      >
        <Clapperboard
          class="size-8 text-primary-warm-gray"
          aria-hidden="true"
        />
        <p class="text-base text-primary-comfy-canvas">
          {{ rc('reshoot.empty.title', locale) }}
        </p>
        <p class="text-xs text-primary-warm-gray">
          {{ rc('reshoot.empty.hint', locale) }}
        </p>
      </div>
      <ReshootStage
        v-else
        v-model:frame="frame"
        :clip
        :camera="view"
        :depth
        :step
        :takes
        :selected
        :current
        cancellable
        :geometry
        :pose
        :keep-aim="keepAim"
        :keys
        :keyed="onKey"
        :status
        :locale
        class="lg:pt-2"
        @aim="demo.aim"
        @select="selected = $event"
        @cancel="demo.cancel"
        @reuse="demo.reuse(selected)"
        @key="demo.toggleKey"
      />
    </div>
    <ReshootExamples
      :active-id="picked && isExample ? 'crossview-example' : undefined"
      :locale
      class="mt-6"
      @pick="demo.pick()"
    />
  </div>
</template>
