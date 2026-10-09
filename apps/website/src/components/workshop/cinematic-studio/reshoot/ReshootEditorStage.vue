<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed } from 'vue'

import EditorFrame from '@/components/workshop/app-editor/EditorFrame.vue'
import type { DepthState, ReshootTake } from '@/composables/useReshoot'
import type {
  CameraKey,
  ReshootCamera,
  ReshootMotion
} from '@/lib/workshop/cinematic-studio/reshoot'
import type { Pose } from '@/lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '@/lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import type { ReshootRunPhase } from '@/lib/workshop/cinematic-studio/reshoot-engine/run'
import type { Locale } from '@/i18n/translations'
import type { ReshootSound, ReshootView } from './output'
import ReshootTakes from './ReshootTakes.vue'
import ReshootTakeView from './ReshootTakeView.vue'
import ReshootTimeline from './ReshootTimeline.vue'
import ReshootViewport from './ReshootViewport.vue'
import { takeLabel } from './take-label'

/**
 * The middle of the full-screen editor: the strip of takes, then the clip
 * being aimed or the take on show, with the timeline under it while aiming.
 */
const {
  clip,
  camera,
  depth,
  stage,
  notice,
  step,
  takes,
  selected,
  current,
  geometry,
  pose,
  keepAim = true,
  keys = [],
  keyed = false,
  view = 'result',
  sound = 'generated',
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  depth: DepthState
  stage?: ReshootRunPhase
  notice?: string
  step: 1 | 2
  takes: readonly ReshootTake[]
  selected: string
  current?: ReshootTake
  geometry?: Geometry
  pose?: Pose
  keepAim?: boolean
  keys?: readonly CameraKey[]
  keyed?: boolean
  view?: ReshootView
  sound?: ReshootSound
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  select: [id: string]
  cancel: []
  key: []
  clearKeys: []
}>()

const frame = defineModel<number>('frame', { default: 0 })
const motion = defineModel<ReshootMotion>('motion', { default: 'smooth' })
const aiming = computed(() =>
  !current && step === 2 && depth === 'ready' && geometry ? geometry : undefined
)
</script>

<template>
  <section
    :aria-label="t('reshoot.title')"
    class="flex size-full max-w-5xl min-w-0 flex-col items-center gap-3"
    data-testid="reshoot-stage"
  >
    <ReshootTakes
      :takes
      :selected
      :locale
      class="shrink-0"
      @select="emit('select', $event)"
    />
    <div class="min-h-0 w-full flex-1">
      <EditorFrame :width="16" :height="9">
        <div
          class="relative size-full rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8"
          data-testid="reshoot-frame"
        >
          <ReshootTakeView
            v-if="current"
            :take="current"
            :clip
            :view
            :sound
            cancellable
            :locale
            @cancel="emit('cancel')"
          />
          <ReshootViewport
            v-else
            :clip
            :camera
            :depth
            :stage
            :notice
            :aimable="step === 2"
            :geometry
            :pose
            :keep-aim="keepAim"
            :frame
            :locale
            @aim="emit('aim', $event)"
          />
        </div>
      </EditorFrame>
    </div>
    <ReshootTimeline
      v-if="aiming"
      v-model:frame="frame"
      v-model:motion="motion"
      :frames="aiming.frames"
      :fps="aiming.fps"
      :keys
      :keyed
      :locale
      class="w-full max-w-3xl shrink-0"
      @key="emit('key')"
      @clear="emit('clearKeys')"
    />
    <p
      v-if="current"
      class="shrink-0 text-center text-xs text-primary-warm-gray"
      data-testid="reshoot-take-caption"
    >
      {{
        current.id === 'example'
          ? t('reshoot.take.exampleHelp')
          : takeLabel(current, locale)
      }}
    </p>
  </section>
</template>
