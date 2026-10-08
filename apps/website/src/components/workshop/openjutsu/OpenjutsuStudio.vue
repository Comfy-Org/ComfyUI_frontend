<script setup lang="ts">
import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import VideoTrimDialog from '@/components/workshop/video-trim/VideoTrimDialog.vue'
import AppsBackLink from '@/components/workshop/cinematic-studio/AppsBackLink.vue'
import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { useOpenjutsu } from '@/composables/useOpenjutsu'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { SWAP_TRIM_LIMITS } from '@/lib/workshop/openjutsu/clip'
import OpenjutsuSide from './OpenjutsuSide.vue'
import OpenjutsuStage from './OpenjutsuStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const swap = useOpenjutsu({ locale })
const {
  sample,
  video,
  videoUrl,
  clipSeconds,
  character,
  characterUrl,
  target,
  seed,
  range,
  frames,
  takes,
  selected,
  current,
  rendering,
  gate,
  missing,
  canGenerate,
  priceNote,
  session,
  trimming,
  trimOpen,
  trimInitial
} = swap

const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => rendering.value,
  () => swap.cancel()
)
</script>

<template>
  <div
    class="mx-auto mb-12 flex w-full max-w-10xl flex-col gap-4 px-4 pt-6 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="openjutsu"
  >
    <AppsBackLink :locale />
    <header class="flex flex-col gap-2">
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ t('openjutsu.title') }}
      </h1>
      <p class="text-base text-primary-warm-gray lg:text-lg">
        {{ t('openjutsu.lead') }}
      </p>
      <p class="text-xs text-primary-warm-gray/80">
        {{ t('openjutsu.credit') }}
      </p>
    </header>
    <p
      v-if="sample"
      class="rounded-xl bg-transparency-white-t8 px-4 py-2.5 text-xs/relaxed text-primary-warm-white"
      data-testid="openjutsu-sample-banner"
    >
      {{ t('openjutsu.sample.banner') }}
    </p>
    <div
      class="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <OpenjutsuSide
        v-model:target="target"
        v-model:seed="seed"
        :video-url="videoUrl"
        :video-name="video?.name"
        :clip-seconds="clipSeconds"
        :frames
        :character-url="characterUrl"
        :character-name="character?.name"
        :missing
        :gate
        :can-generate="canGenerate"
        :rendering
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        :locale
        @video="swap.takeVideo"
        @character="swap.takeCharacter"
        @trim="swap.editTrim"
        @generate="swap.generate"
      />
      <OpenjutsuStage
        :video-url="videoUrl"
        :clip-seconds="clipSeconds"
        :range
        :frames
        :takes
        :selected
        :current
        :rendering
        :sample
        :locale
        class="lg:pt-2"
        @select="selected = $event"
        @trim="swap.editTrim"
        @cancel="swap.cancel"
        @reuse="swap.reuse"
      />
    </div>
    <VideoTrimDialog
      v-model:open="trimOpen"
      :file="trimming"
      :limits="SWAP_TRIM_LIMITS"
      :initial="trimInitial"
      :locale
      @confirm="swap.confirmTrim"
    />
    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && stay()"
      @leave="leave"
    />
  </div>
</template>
