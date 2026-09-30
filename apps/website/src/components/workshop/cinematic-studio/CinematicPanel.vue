<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import { shotAspects } from '../../../lib/workshop/cinematic-studio/models'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import { videoTags } from '../../../lib/workshop/cinematic-studio/video'
import type { ShotBlock } from '../../../composables/useCinematicShot'
import type { StudioImage } from '../../../lib/workshop/cinematic-studio/take-image'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicReferenceButton from './CinematicReferenceButton.vue'
import CinematicSceneField from './CinematicSceneField.vue'
import CinematicShotList from './CinematicShotList.vue'
import CinematicVideoControls from './CinematicVideoControls.vue'
import type { PickerKey } from './picker-key'
import { referenceSlots } from './reference-kind'

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

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    logo: model.logo,
    meta: videoTags(model.video, tc('cinematic.video.audioTag', locale))
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)
const slots = computed(() => referenceSlots(model.value, !!firstFrame.value))
const files = { cast, firstFrame, lastFrame, video: sourceVideo }
const blockedNote = computed(() =>
  blocked ? tc(blocked.key, locale, { model: blocked.model }) : undefined
)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0 && !blockedNote.value
)
const cardClass =
  'flex w-full items-center gap-3 rounded-2xl border border-transparency-white-t8 p-2.5 text-left transition-colors hover:border-transparency-white-t20'
</script>

<template>
  <aside
    :aria-label="tc('cinematic.panel.label', locale)"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <header
      class="flex min-h-13 items-center justify-between gap-3 border-b border-transparency-white-t8 py-2 pr-2 pl-5"
    >
      <h2 class="text-sm font-semibold text-primary-warm-white">
        {{ tc('cinematic.panel.newShot', locale) }}
      </h2>
      <slot name="mode" />
    </header>
    <div class="flex flex-col gap-4 p-4">
      <CinematicMenu
        v-model="modelSlug"
        :options="modelOptions"
        :heading="tc('cinematic.model.heading', locale)"
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
      <section :aria-label="tc('cinematic.section.shot', locale)">
        <CinematicShotList
          :direction
          :colors
          :open-picker="openPicker"
          :locale
          @open="emit('open', $event)"
        />
      </section>
      <section
        :aria-label="tc('cinematic.section.output', locale)"
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

    <footer
      class="mt-auto flex flex-col gap-2.5 rounded-b-2xl border-t border-transparency-white-t8 p-3"
    >
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        :blocked-note="blockedNote"
        :estimate
        :credits
        wide
        :show-credits="showCredits"
        :locale
        @generate="emit('generate')"
        @cancel="emit('cancel')"
        @reduce-takes="takes = $event"
      />
    </footer>
  </aside>
</template>
