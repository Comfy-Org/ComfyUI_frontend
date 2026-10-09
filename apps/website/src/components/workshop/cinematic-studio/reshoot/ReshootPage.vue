<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { Clapperboard } from '@lucide/vue'
import { computed } from 'vue'

import type { useReshoot } from '@/composables/useReshoot'
import type { Locale } from '@/i18n/translations'
import AppsBackLink from '@/components/workshop/cinematic-studio/AppsBackLink.vue'
import ReshootHeader from './ReshootHeader.vue'
import ReshootExamples from './ReshootExamples.vue'
import ReshootSide from './ReshootSide.vue'
import ReshootStage from './ReshootStage.vue'
import ReshootUpload from './ReshootUpload.vue'

const { reshoot, locale = 'en' } = defineProps<{
  reshoot: ReturnType<typeof useReshoot>
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  stage,
  notice,
  frames,
  clipError,
  geometry,
  step,
  view,
  pose,
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
  gate,
  canGenerate,
  priceNote,
  session
} = reshoot

const readFailed = computed(() => depth.value === 'failed')
const exampleId = computed(() =>
  picked.value && isExample.value ? 'crossview-example' : undefined
)
</script>

<template>
  <div
    class="mx-auto mb-12 flex w-full max-w-10xl flex-col gap-4 px-4 pt-6 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale />
    <ReshootHeader :locale class="mb-4" />
    <div
      class="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <ReshootUpload v-if="!picked" :locale @pick="reshoot.pick" />
      <!-- A failed read is said once, beside its Try again button; the
           viewport keeps the notices that no button can fix. -->
      <ReshootSide
        v-else
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:seed="seed"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:prompt="prompt"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :camera="view"
        :keys
        :depth
        :frames
        :clip-error="clipError"
        :error="readFailed ? notice : undefined"
        :gate
        :can-generate="canGenerate"
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        :locale
        @aim="reshoot.aim"
        @remove-key="reshoot.removeKey"
        @analyze="reshoot.analyze"
        @generate="reshoot.generate"
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
          {{ t('reshoot.empty.title') }}
        </p>
        <p class="text-xs text-primary-warm-gray">
          {{ t('reshoot.empty.hint') }}
        </p>
      </div>
      <ReshootStage
        v-else
        v-model:frame="frame"
        v-model:motion="motion"
        :clip
        :camera="view"
        :depth
        :stage
        :notice="readFailed ? undefined : notice"
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
        :locale
        class="lg:pt-2"
        @aim="reshoot.aim"
        @select="selected = $event"
        @cancel="reshoot.cancel"
        @reuse="reshoot.reuse(selected)"
        @key="reshoot.toggleKey"
        @clear-keys="keys = []"
      />
    </div>
    <ReshootExamples
      :active-id="exampleId"
      :locale
      class="mt-6"
      @pick="reshoot.pick()"
    />
  </div>
</template>
