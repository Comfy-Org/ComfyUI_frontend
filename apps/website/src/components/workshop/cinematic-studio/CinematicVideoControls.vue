<script setup lang="ts">
import { ChevronDown, Clock, Maximize, Volume2, VolumeX } from '@lucide/vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
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

const triggerClass =
  'h-10 w-full gap-2 border border-transparency-white-t8 px-3 text-sm max-sm:justify-center max-sm:gap-1.5 max-sm:px-2 text-primary-warm-white hover:border-transparency-white-t20'
</script>

<template>
  <div
    role="group"
    :aria-label="tc('cinematic.section.output', locale)"
    :class="cn('grid gap-2', video.audioField ? 'grid-cols-4' : 'grid-cols-3')"
  >
    <CinematicMenu
      v-if="aspectOptions.length"
      v-model="aspectValue"
      :options="aspectOptions"
      :heading="tc('cinematic.video.aspect', locale)"
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
      <span class="text-left tabular-nums sm:flex-1">{{ aspect }}</span>
      <ChevronDown
        class="size-3.5 text-primary-warm-gray max-sm:hidden"
        aria-hidden="true"
      />
    </CinematicMenu>
    <CinematicMenu
      v-if="resolutionOptions.length"
      v-model="resolutionValue"
      :options="resolutionOptions"
      :heading="tc('cinematic.video.resolution', locale)"
      side="bottom"
      tooltip
      :trigger-class
    >
      <Maximize class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="text-left sm:flex-1">
        {{ resolution && resolutionLabel(resolution) }}
      </span>
      <ChevronDown
        class="size-3.5 text-primary-warm-gray max-sm:hidden"
        aria-hidden="true"
      />
    </CinematicMenu>
    <CinematicMenu
      v-if="durationOptions.length"
      v-model="durationValue"
      :options="durationOptions"
      :heading="tc('cinematic.video.duration', locale)"
      side="bottom"
      tooltip
      :trigger-class
    >
      <Clock class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
      <span class="text-left tabular-nums sm:flex-1">{{ duration }}s</span>
      <ChevronDown
        class="size-3.5 text-primary-warm-gray max-sm:hidden"
        aria-hidden="true"
      />
    </CinematicMenu>
    <CinematicTooltip
      v-if="video.audioField"
      :heading="tc('cinematic.video.audio', locale)"
      :text="`${tc('cinematic.video.audioHint', locale)} ${tc(
        durationOptions.length
          ? 'cinematic.video.oneClip'
          : 'cinematic.video.modelDecides',
        locale
      )}`"
    >
      <button
        type="button"
        role="switch"
        :aria-checked="audio"
        :aria-label="tc('cinematic.video.audio', locale)"
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
        <span class="text-xs font-semibold tracking-wide uppercase">
          {{
            tc(
              audio ? 'cinematic.video.audioOn' : 'cinematic.video.audioOff',
              locale
            )
          }}
        </span>
      </button>
    </CinematicTooltip>
  </div>
</template>
