<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  directionOption
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import { videoTags } from '../../../lib/workshop/cinematic-studio/video'
import type { ShotBlock } from '../../../composables/useCinematicShot'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import type { Locale } from '../../../i18n/site'
import { studioT as tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicDirectionSegments from './CinematicDirectionSegments.vue'
import CinematicEnhanceSwitch from './CinematicEnhanceSwitch.vue'
import CinematicFormatSegments from './CinematicFormatSegments.vue'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import CinematicReferenceMenu from './CinematicReferenceMenu.vue'
import CinematicTooltip from './CinematicTooltip.vue'
import CinematicVideoSegments from './CinematicVideoSegments.vue'
import type { PickerKey } from './picker-key'
import type { ReferenceKind } from './reference-kind'

const {
  models,
  aspects,
  slots,
  colors = [],
  blocked,
  video,
  direction,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  showCredits = true,
  openPopover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  /** The frames the chosen model can make; every frame when absent. */
  aspects?: readonly AspectRatio[]
  /** The files the shot can take, listed in the References menu. */
  slots?: readonly ReferenceKind[]
  /** The visitor's own palette, shown on the Grade segment. */
  colors?: readonly string[]
  blocked?: ShotBlock
  /** Present in video mode: what the running operation lets a shot choose. */
  video?: CinematicVideoCapabilities
  direction: Direction
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  showCredits?: boolean
  openPopover?: PickerKey
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: PickerKey]
  generate: []
  cancel: []
}>()

const scene = defineModel<string>('scene', { required: true })
const modelSlug = defineModel<string>('model', { required: true })
const takes = defineModel<number>('takes', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const cast = defineModel<StudioImage | undefined>('cast')
const firstFrame = defineModel<StudioImage | undefined>('firstFrame')
const lastFrame = defineModel<StudioImage | undefined>('lastFrame')
const sourceVideo = defineModel<StudioImage | undefined>('sourceVideo')
const duration = defineModel<number | undefined>('duration')
const videoResolution = defineModel<string | undefined>('videoResolution')
const audio = defineModel<boolean>('audio', { default: false })

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    logo: model.logo,
    meta: model.degraded
      ? tc('cinematic.model.degraded', {}, { locale: locale })
      : videoTags(
          model.video,
          tc('cinematic.video.audioTag', {}, { locale: locale })
        )
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)

const bodyLabel = computed(() =>
  tc(directionOption('body', direction).label, {}, { locale: locale })
)
const cameraSummary = computed(
  () =>
    `${tc('cinematic.section.camera', {}, { locale: locale })}: ${cameraGroups
      .map((group) =>
        tc(directionOption(group.part, direction).label, {}, { locale: locale })
      )
      .join(' · ')}`
)
const focalLabel = computed(() => {
  const focal = directionOption('focal', direction)
  return focal.id === 'auto'
    ? undefined
    : tc(focal.label, {}, { locale: locale })
})
const cameraLabel = computed(
  () =>
    `${tc('cinematic.section.camera', {}, { locale: locale })}: ${focalLabel.value ?? bodyLabel.value}`
)
const blockedNote = computed(() =>
  blocked
    ? tc(blocked.key, { model: blocked.model }, { locale: locale })
    : undefined
)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0 && !blockedNote.value
)

function generateFromKeyboard() {
  if (canGenerate.value && !rendering) emit('generate')
}

const chipClass = (key: PickerKey) =>
  cn(
    'flex h-9 max-w-80 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
    openPopover === key &&
      'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
  )
</script>

<template>
  <div
    class="flex w-full flex-col overflow-hidden rounded-3xl border border-transparency-white-t8 bg-primary-comfy-ink-light shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
    role="group"
    :aria-label="tc('cinematic.composer.label', {}, { locale: locale })"
  >
    <div class="flex flex-wrap items-start gap-x-2.5 gap-y-1 px-4 pt-3.5 pb-3">
      <CinematicReferenceMenu
        v-model:cast="cast"
        v-model:first-frame="firstFrame"
        v-model:last-frame="lastFrame"
        v-model:source-video="sourceVideo"
        :shown="slots"
        :locale
      />
      <label for="cinematic-scene" class="sr-only">
        {{ tc('cinematic.section.scene', {}, { locale: locale }) }}
      </label>
      <textarea
        id="cinematic-scene"
        v-model="scene"
        rows="1"
        :placeholder="tc('cinematic.scene.placeholder', {}, { locale: locale })"
        class="field-sizing-content max-h-[calc(4lh+0.375rem)] min-h-9 flex-1 resize-none bg-transparent pt-1.5 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        @keydown.enter.meta.prevent="generateFromKeyboard"
        @keydown.enter.ctrl.prevent="generateFromKeyboard"
      />
      <CinematicEnhanceSwitch
        v-model="enhance"
        :video="!!video"
        :locale
        class="h-9 shrink-0 text-primary-comfy-canvas max-sm:order-first max-sm:h-6 max-sm:basis-full max-sm:justify-end"
      />
    </div>

    <div
      class="flex flex-wrap items-center gap-2 border-t border-transparency-white-t8 px-3 py-2.5"
    >
      <div
        class="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 py-0.5 sm:basis-auto"
      >
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="tc('cinematic.model.heading', {}, { locale: locale })"
          tooltip
          trigger-class="h-9 shrink-0 gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-warm-white hover:bg-transparency-white-t8"
        >
          <img
            v-if="model"
            :src="model.logo"
            alt=""
            class="size-4 brightness-0 invert"
          />
          {{ model?.name }}
          <ChevronDown
            class="size-3 text-primary-warm-gray"
            aria-hidden="true"
          />
        </CinematicMenu>
        <CinematicTooltip :text="cameraSummary">
          <button
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPopover === 'camera'"
            :aria-label="cameraLabel"
            :class="chipClass('camera')"
            @click="emit('open', 'camera')"
          >
            <CinematicOptionIcon
              part="body"
              :option="direction.body"
              class="h-6 w-10 shrink-0"
            />
            <span class="tabular-nums">{{ focalLabel ?? bodyLabel }}</span>
          </button>
        </CinematicTooltip>
        <CinematicDirectionSegments
          :direction
          :colors
          :open="openPopover"
          :locale
          @open="emit('open', $event)"
        />
        <CinematicVideoSegments
          v-if="video"
          v-model:aspect="aspect"
          v-model:duration="duration"
          v-model:resolution="videoResolution"
          v-model:audio="audio"
          :video
          :locale
        />
        <CinematicFormatSegments
          v-else
          v-model:aspect="aspect"
          v-model:resolution="resolution"
          v-model:takes="takes"
          :aspects
          :locale
        />
      </div>
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        :blocked-note="blockedNote"
        :estimate
        :credits
        :show-credits="showCredits"
        :locale
        class="ml-auto"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
        @reduce-takes="takes = $event"
      />
    </div>
  </div>
</template>
