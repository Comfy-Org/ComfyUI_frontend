<script setup lang="ts">
import { Maximize2, Minimize2 } from '@lucide/vue'
import { useFullscreen } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import type {
  DepthState,
  ReshootTake
} from '../../../../composables/useReshoot'
import type {
  CameraKey,
  ReshootCamera,
  ReshootMotion
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import type { Pose } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/camera'
import type { Geometry } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/cvgeo'
import type { ReshootRunPhase } from '../../../../lib/workshop/cinematic-studio/reshoot-engine/run'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootSound, ReshootView } from './output'
import ReshootOutputBar from './ReshootOutputBar.vue'
import ReshootTakes from './ReshootTakes.vue'
import ReshootTakeView from './ReshootTakeView.vue'
import ReshootTimeline from './ReshootTimeline.vue'
import ReshootViewport from './ReshootViewport.vue'
import { takeLabel } from './take-label'

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
  cancellable = false,
  geometry,
  pose,
  keepAim = true,
  keys = [],
  keyed = false,
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
  cancellable?: boolean
  geometry?: Geometry
  pose?: Pose
  keepAim?: boolean
  keys?: readonly CameraKey[]
  keyed?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  select: [id: string]
  cancel: []
  reuse: []
  key: []
  clearKeys: []
}>()

const frame = defineModel<number>('frame', { default: 0 })
const motion = defineModel<ReshootMotion>('motion', { default: 'smooth' })
// the timeline belongs to aiming: live depth and no take in the frame
const aiming = computed(() =>
  !current && step === 2 && depth === 'ready' && geometry ? geometry : undefined
)

const frameEl = useTemplateRef<HTMLElement>('frameEl')
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(frameEl)

const generated = computed(() =>
  takes.some((take) => take.id !== 'example' && take.status === 'done')
)

const view = ref<ReshootView>('result')
const sound = ref<ReshootSound>('generated')
const finished = computed(() =>
  current?.status === 'done' && current.url ? current : undefined
)
const href = computed(() =>
  sound.value === 'original'
    ? (finished.value?.originalUrl ?? finished.value?.url)
    : finished.value?.url
)
const fileName = computed(
  () =>
    `crossview-take-${current?.n ?? 0}${sound.value === 'original' ? '-original-audio' : ''}.mp4`
)
</script>

<template>
  <section
    :aria-label="rc('reshoot.title', locale)"
    class="flex min-h-0 w-full flex-1 flex-col items-center gap-3 max-lg:contents"
  >
    <div
      class="flex w-[min(100%,calc(52svh*16/9))] flex-col gap-3 max-lg:contents"
    >
      <ReshootOutputBar
        v-if="href"
        v-model:view="view"
        v-model:sound="sound"
        class="max-lg:order-first"
        :href
        :file-name="fileName"
        :locale
        @reuse="emit('reuse')"
      />
      <div
        ref="frameEl"
        class="group/frame relative aspect-video w-full rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8 max-lg:sticky max-lg:top-20 max-lg:z-20 max-lg:order-first max-lg:shadow-[0_12px_24px_rgb(0_0_0/0.45)]"
        data-testid="reshoot-frame"
      >
        <ReshootTakeView
          v-if="current"
          :take="current"
          :clip
          :view
          :sound
          :cancellable
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
          :generated
          :locale
          @aim="emit('aim', $event)"
        />
        <button
          type="button"
          :aria-label="
            rc(isFullscreen ? 'reshoot.collapse' : 'reshoot.expand', locale)
          "
          :title="
            rc(isFullscreen ? 'reshoot.collapse' : 'reshoot.expand', locale)
          "
          class="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full bg-primary-comfy-ink/80 text-primary-warm-white opacity-70 transition-opacity group-hover/frame:opacity-100 hover:bg-primary-comfy-ink focus-visible:opacity-100"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="isFullscreen" class="size-4" aria-hidden="true" />
          <Maximize2 v-else class="size-4" aria-hidden="true" />
        </button>
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
        @key="emit('key')"
        @clear="emit('clearKeys')"
      />
      <p
        class="min-h-4 text-xs text-primary-warm-gray max-lg:order-last"
        data-testid="reshoot-take-caption"
      >
        <template v-if="current">
          {{
            current.id === 'example'
              ? rc('reshoot.take.exampleHelp', locale)
              : takeLabel(current, locale)
          }}
        </template>
      </p>
      <ReshootTakes
        :takes
        :selected
        :locale
        class="-ml-1 self-start max-lg:order-last"
        @select="emit('select', $event)"
      />
    </div>
  </section>
</template>
