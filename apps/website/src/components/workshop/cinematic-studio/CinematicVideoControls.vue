<script setup lang="ts">
import { ChevronDown, Clock, Info, Maximize } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import { ref, useTemplateRef } from 'vue'

import type { AspectRatio } from '../../../lib/workshop/cinematic-studio/catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import { resolutionLabel } from '../../../lib/workshop/cinematic-studio/video'
import { framedStyle } from './aspect-style'
import CinematicMenu from './CinematicMenu.vue'
import { useVideoMenus } from './useVideoMenus'

const { video, locale = 'en' } = defineProps<{
  video: CinematicVideoCapabilities
  locale?: Locale
}>()

const aspect = defineModel<AspectRatio>('aspect', { required: true })
const duration = defineModel<number | undefined>('duration')
const resolution = defineModel<string | undefined>('resolution')
const audio = defineModel<boolean>('audio', { required: true })

const aboutOpen = ref(false)
const about = useTemplateRef<HTMLElement>('about')
onClickOutside(about, () => (aboutOpen.value = false))

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
  <div class="flex flex-col gap-3">
    <div
      role="group"
      :aria-label="tc('cinematic.section.output', locale)"
      class="grid grid-cols-3 gap-2"
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
        <span class="flex-1 text-left tabular-nums">{{ aspect }}</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
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
        <span class="flex-1 text-left">
          {{ resolution && resolutionLabel(resolution) }}
        </span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
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
        <span class="flex-1 text-left tabular-nums">{{ duration }}s</span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
    </div>
    <div class="flex items-center gap-2">
      <label
        v-if="video.audioField"
        class="flex w-fit cursor-pointer items-center gap-2.5 text-xs text-primary-warm-white"
      >
        <input
          v-model="audio"
          type="checkbox"
          role="switch"
          class="peer sr-only"
        />
        <span
          class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
          aria-hidden="true"
        />
        {{ tc('cinematic.video.audio', locale) }}
      </label>
      <div ref="about" class="relative">
        <button
          type="button"
          class="grid size-6 place-items-center rounded-full text-primary-warm-gray transition-colors hover:text-primary-warm-white focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
          :aria-label="tc('cinematic.video.about', locale)"
          :aria-expanded="aboutOpen"
          @click="aboutOpen = !aboutOpen"
        >
          <Info class="size-3.5" aria-hidden="true" />
        </button>
        <p
          v-if="aboutOpen"
          role="note"
          class="absolute bottom-full left-1/2 z-30 mb-1.5 w-64 -translate-x-1/2 rounded-xl border border-transparency-white-t8 bg-primary-comfy-ink-light px-3 py-2 text-xs/relaxed text-primary-comfy-canvas shadow-lg"
        >
          {{
            tc(
              durationOptions.length
                ? 'cinematic.video.oneClip'
                : 'cinematic.video.modelDecides',
              locale
            )
          }}
        </p>
      </div>
    </div>
  </div>
</template>
