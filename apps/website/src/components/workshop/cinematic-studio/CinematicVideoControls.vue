<script setup lang="ts">
import { ChevronDown, Clock, Maximize, Volume2, VolumeX } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AspectRatio } from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CinematicVideoCapabilities } from '@/lib/workshop/cinematic-studio/video'
import { resolutionLabel } from '@/lib/workshop/cinematic-studio/video'
import { framedStyle } from './aspect-style'
import CinematicMenu from './CinematicMenu.vue'
import CinematicTooltip from './CinematicTooltip.vue'
import { useVideoMenus } from './useVideoMenus'

const { video, locale = 'en' } = defineProps<{
  video: CinematicVideoCapabilities
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

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

const triggerClass =
  'h-10 w-full gap-2 border border-transparency-white-t8 px-3 text-sm text-primary-warm-white hover:border-transparency-white-t20'
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.section.output')"
    class="grid grid-cols-2 gap-2"
  >
    <CinematicMenu
      v-if="aspectOptions.length"
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.video.aspect')"
      side="bottom"
      tooltip
      :trigger-class
    >
      <span class="grid size-4 place-items-center" aria-hidden="true">
        <span
          class="block max-h-full rounded-xs border-[1.5px] border-primary-warm-gray"
          :style="framedStyle(aspect, '1rem')"
        />
      </span>
      <span class="flex-1 text-left tabular-nums">{{ aspect }}</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicMenu
      v-if="resolutionOptions.length"
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.video.resolution')"
      side="bottom"
      tooltip
      :trigger-class
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left">
        {{ resolution && resolutionLabel(resolution) }}
      </span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicMenu
      v-if="durationOptions.length"
      v-model="durationValue"
      :options="durationOptions"
      :heading="tc('cinematic.video.duration')"
      side="bottom"
      tooltip
      :trigger-class
    >
      <Clock class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="flex-1 text-left tabular-nums">{{ duration }}s</span>
      <ChevronDown class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicTooltip
      v-if="video.audioField"
      :heading="tc('cinematic.video.audio')"
      :text="`${tc('cinematic.video.audioHint')} ${tc(
        durationOptions.length
          ? 'cinematic.video.oneClip'
          : 'cinematic.video.modelDecides'
      )}`"
    >
      <button
        type="button"
        role="switch"
        :aria-checked="audio"
        :aria-label="tc('cinematic.video.audio')"
        :class="
          cn(
            'flex items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50',
            triggerClass,
            'justify-center transition-colors',
            audio
              ? 'border-transparency-white-t20 bg-transparency-white-t8'
              : 'text-primary-warm-gray'
          )
        "
        @click="audio = !audio"
      >
        <component
          :is="audio ? Volume2 : VolumeX"
          class="size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="text-sm">
          {{
            tc(audio ? 'cinematic.video.audioOn' : 'cinematic.video.audioOff')
          }}
        </span>
      </button>
    </CinematicTooltip>
  </div>
</template>
