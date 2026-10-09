<script setup lang="ts">
import type {
  AspectRatio,
  Direction,
  Resolution
} from '@/lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '@/lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '@/lib/workshop/cinematic-studio/gate'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { CinematicVideoCapabilities } from '@/lib/workshop/cinematic-studio/video'
import type { ShotBlock } from '@/composables/useCinematicShot'
import type { StudioImage } from '@/lib/workshop/cinematic-studio/take-image'
import CinematicPanelFields from './CinematicPanelFields.vue'
import CinematicPanelRun from './CinematicPanelRun.vue'
import type { PickerKey } from './picker-key'

const {
  models,
  blocked,
  video,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  showCredits = true,
  openPicker,
  colors = [],
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  blocked?: ShotBlock
  /** Present in video mode: what the running operation lets a shot choose. */
  video?: CinematicVideoCapabilities
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  showCredits?: boolean
  openPicker?: PickerKey
  /** The visitor's own palette, shown on the Grade row. */
  colors?: readonly string[]
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const emit = defineEmits<{
  open: [key: PickerKey]
  generate: []
  cancel: []
}>()

const modelSlug = defineModel<string>('model', { required: true })
const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const direction = defineModel<Direction>('direction', { required: true })
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
</script>

<template>
  <aside
    :aria-label="tc('cinematic.panel.label')"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <header
      class="flex min-h-13 items-center justify-between gap-3 border-b border-transparency-white-t8 py-2 pr-2 pl-5"
    >
      <h2 class="text-sm font-semibold text-primary-warm-white">
        {{ tc('cinematic.panel.newShot') }}
      </h2>
      <slot name="mode" />
    </header>
    <CinematicPanelFields
      v-model:model="modelSlug"
      v-model:scene="scene"
      v-model:enhance="enhance"
      v-model:aspect="aspect"
      v-model:resolution="resolution"
      v-model:takes="takes"
      v-model:cast="cast"
      v-model:duration="duration"
      v-model:video-resolution="videoResolution"
      v-model:audio="audio"
      v-model:first-frame="firstFrame"
      v-model:last-frame="lastFrame"
      v-model:source-video="sourceVideo"
      :models
      :video
      :direction
      :open-picker="openPicker"
      :colors
      :locale
      class="p-4"
      @open="emit('open', $event)"
    />

    <footer
      class="mt-auto flex flex-col gap-2.5 rounded-b-2xl border-t border-transparency-white-t8 p-3"
    >
      <CinematicPanelRun
        v-model:takes="takes"
        :scene
        :blocked
        :gate
        :workspace-name="workspaceName"
        :rendering
        :estimate
        :credits
        :show-credits="showCredits"
        :locale
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
    </footer>
  </aside>
</template>
