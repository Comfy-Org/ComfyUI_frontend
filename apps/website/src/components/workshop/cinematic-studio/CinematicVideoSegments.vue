<script setup lang="ts">
import { Volume2, VolumeX } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/site'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import { resolutionLabel } from '../../../lib/workshop/cinematic-studio/video'
import { framedStyle } from './aspect-style'
import CinematicMenu from './CinematicMenu.vue'
import CinematicTooltip from './CinematicTooltip.vue'
import { useVideoMenus } from './useVideoMenus'

const { video, locale = 'en' } = defineProps<{
  video: CinematicVideoCapabilities
  locale?: Locale
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const duration = defineModel<number | undefined>('duration')
const resolution = defineModel<string | undefined>('resolution')
const audio = defineModel<boolean>('audio', { required: true })

const {
  aspectOptions,
  durationOptions,
  resolutionOptions,
  aspectValue,
  durationValue,
  resolutionValue
} = useVideoMenus(
  aspect,
  duration,
  resolution,
  () => video,
  () => locale
)

const segmentClass =
  'h-full gap-2 rounded-none px-3 text-primary-comfy-canvas hover:bg-transparency-white-t4 hover:text-primary-warm-white data-[state=open]:text-primary-warm-white'
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.composer.format', {}, { locale: locale })"
    class="flex h-9 shrink-0 items-center overflow-hidden rounded-xl text-[13px] whitespace-nowrap ring-1 ring-transparency-white-t8 ring-inset [&>*+*]:border-l [&>*+*]:border-transparency-white-t8"
  >
    <CinematicMenu
      v-if="aspectOptions.length"
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.video.aspect', {}, { locale: locale })"
      :trigger-class="segmentClass"
      tooltip
    >
      <span class="grid size-4 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-current"
          :style="framedStyle(aspect, '1rem')"
        />
      </span>
      {{ aspect }}
    </CinematicMenu>
    <CinematicMenu
      v-if="resolutionOptions.length"
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.video.resolution', {}, { locale: locale })"
      :trigger-class="segmentClass"
      tooltip
    >
      {{ resolution && resolutionLabel(resolution) }}
    </CinematicMenu>
    <CinematicMenu
      v-if="durationOptions.length"
      v-model="durationValue"
      :options="durationOptions"
      :heading="tc('cinematic.video.duration', {}, { locale: locale })"
      :trigger-class="segmentClass"
      tooltip
    >
      {{ duration }}s
    </CinematicMenu>
    <CinematicTooltip
      v-if="video.audioField"
      :text="tc('cinematic.video.audio', {}, { locale: locale })"
    >
      <button
        type="button"
        :aria-pressed="audio"
        :aria-label="tc('cinematic.video.audio', {}, { locale: locale })"
        :class="
          cn(
            'flex h-full items-center gap-2 px-3 text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t4 hover:text-primary-warm-white',
            audio && 'text-primary-warm-white'
          )
        "
        @click="audio = !audio"
      >
        <Volume2 v-if="audio" class="size-4" aria-hidden="true" />
        <VolumeX v-else class="size-4" aria-hidden="true" />
        {{ tc('cinematic.video.audioTag', {}, { locale: locale }) }}
      </button>
    </CinematicTooltip>
    <span
      v-if="!aspectOptions.length && !durationOptions.length"
      class="px-3 text-primary-warm-gray"
    >
      {{ tc('cinematic.video.modelDecides', {}, { locale: locale }) }}
    </span>
  </div>
</template>
