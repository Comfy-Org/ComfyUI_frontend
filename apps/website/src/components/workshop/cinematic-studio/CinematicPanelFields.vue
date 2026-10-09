<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  Resolution
} from '@/lib/workshop/cinematic-studio/catalog'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import { shotAspects } from '@/lib/workshop/cinematic-studio/models'
import type { CinematicVideoCapabilities } from '@/lib/workshop/cinematic-studio/video'
import { videoTags } from '@/lib/workshop/cinematic-studio/video'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicReferenceButton from './CinematicReferenceButton.vue'
import CinematicSceneField from './CinematicSceneField.vue'
import CinematicShotList from './CinematicShotList.vue'
import CinematicStartingTile from './CinematicStartingTile.vue'
import CinematicVideoControls from './CinematicVideoControls.vue'
import type { PickerKey } from './picker-key'
import { referenceSlots, startingInput } from './reference-kind'

const {
  models,
  video,
  direction,
  openPicker,
  colors = [],
  startTile = false,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  /** Present in video mode: what the running operation lets a shot choose. */
  video?: CinematicVideoCapabilities
  direction: Direction
  openPicker?: PickerKey
  /** The visitor's own palette, shown on the Grade row. */
  colors?: readonly string[]
  /** Lifts what a clip starts from out of the scene box, to the top on its own. */
  startTile?: boolean
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const emit = defineEmits<{ open: [key: PickerKey] }>()

const modelSlug = defineModel<string>('model', { required: true })
const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })
const cast = defineModel<StudioImage | undefined>('cast')
const duration = defineModel<number | undefined>('duration')
const videoResolution = defineModel<string | undefined>('videoResolution')
const audio = defineModel<boolean>('audio', { default: false })
const firstFrame = defineModel<StudioImage | undefined>('firstFrame')
const lastFrame = defineModel<StudioImage | undefined>('lastFrame')
const sourceVideo = defineModel<StudioImage | undefined>('sourceVideo')

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    logo: model.logo,
    meta: videoTags(model.video, tc('cinematic.video.audioTag'))
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)
const start = computed(() =>
  startTile ? startingInput(model.value) : undefined
)
const slots = computed(() =>
  referenceSlots(model.value, !!firstFrame.value).filter(
    (kind) => kind !== start.value?.kind
  )
)
const files = { cast, firstFrame, lastFrame, video: sourceVideo }
const cardClass =
  'flex w-full items-center gap-3 rounded-2xl border border-transparency-white-t8 p-2.5 text-left transition-colors hover:border-transparency-white-t20'
</script>

<template>
  <div class="flex flex-col gap-4">
    <CinematicStartingTile
      v-if="start"
      :key="start.kind"
      v-model="files[start.kind].value"
      :start
      :locale
    />
    <CinematicMenu
      v-model="modelSlug"
      :options="modelOptions"
      :heading="tc('cinematic.model.heading')"
      :show-heading="false"
      side="bottom"
      :trigger-class="cn(cardClass, 'h-11 gap-3 px-3')"
    >
      <img
        v-if="model"
        :src="model.logo"
        alt=""
        class="size-5 brightness-0 invert"
      />
      <span class="flex-1 text-sm font-semibold text-primary-warm-white">
        {{ model?.name }}
      </span>
      <ChevronDown class="size-4 text-primary-warm-gray" aria-hidden="true" />
    </CinematicMenu>
    <CinematicSceneField
      v-model:scene="scene"
      v-model:enhance="enhance"
      :video="!!video"
      :locale
    >
      <div class="flex items-center gap-2">
        <CinematicReferenceButton
          v-for="kind in slots"
          :key="kind"
          v-model="files[kind].value"
          :kind
          :locale
        />
      </div>
    </CinematicSceneField>
    <section :aria-label="tc('cinematic.section.shot')">
      <CinematicShotList
        :direction
        :colors
        :open-picker="openPicker"
        :locale
        @open="emit('open', $event)"
      />
    </section>
    <section
      :aria-label="tc('cinematic.section.output')"
      class="flex flex-col gap-2"
    >
      <CinematicVideoControls
        v-if="video"
        v-model:aspect="aspect"
        v-model:duration="duration"
        v-model:resolution="videoResolution"
        v-model:audio="audio"
        :video
        :locale
      />
      <CinematicOutputControls
        v-else
        v-model:aspect="aspect"
        v-model:resolution="resolution"
        v-model:takes="takes"
        :aspects="shotAspects(model, !!cast)"
        :locale
      />
    </section>
  </div>
</template>
