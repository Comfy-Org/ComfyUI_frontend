<script setup lang="ts">
import { Maximize2, Minimize2 } from '@lucide/vue'
import { useFullscreen } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import type {
  DepthState,
  ReshootTake
} from '../../../../composables/useReshootDemo'
import type { ReshootCamera } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import type { ReshootSound, ReshootView } from './output'
import ReshootOutputBar from './ReshootOutputBar.vue'
import ReshootTakes from './ReshootTakes.vue'
import ReshootTakeView from './ReshootTakeView.vue'
import ReshootViewport from './ReshootViewport.vue'
import { takeLabel } from './take-label'

const {
  clip,
  camera,
  depth,
  step,
  takes,
  selected,
  current,
  cancellable = false,
  locale = 'en'
} = defineProps<{
  clip: string
  camera: Readonly<ReshootCamera>
  depth: DepthState
  step: 1 | 2
  takes: readonly ReshootTake[]
  selected: string
  current?: ReshootTake
  cancellable?: boolean
  locale?: Locale
}>()

const emit = defineEmits<{
  aim: [patch: Partial<ReshootCamera>]
  select: [id: string]
  cancel: []
}>()

const frameEl = useTemplateRef<HTMLElement>('frameEl')
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(frameEl)

const view = ref<ReshootView>('result')
const sound = ref<ReshootSound>('generated')
const finished = computed(() =>
  current?.status === 'done' && current.url ? current : undefined
)
const fileName = computed(
  () =>
    `crossview-take-${current?.n ?? 0}${sound.value === 'original' ? '-original-audio' : ''}.mp4`
)
</script>

<template>
  <section
    :aria-label="rc('reshoot.title', locale)"
    class="flex min-h-0 w-full flex-1 flex-col items-center gap-3"
  >
    <div class="flex w-[min(100%,calc(52svh*16/9))] flex-col gap-3">
      <ReshootOutputBar
        v-if="finished?.url"
        v-model:view="view"
        v-model:sound="sound"
        :href="finished.url"
        :file-name="fileName"
        :locale
      />
      <div
        ref="frameEl"
        class="group/frame relative aspect-video w-full rounded-md bg-primary-comfy-ink ring-1 ring-transparency-white-t8"
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
          :aimable="step === 2"
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
    </div>
    <p class="text-xs text-primary-warm-gray">
      {{
        current ? takeLabel(current, locale) : rc('reshoot.take.aim', locale)
      }}
    </p>
    <ReshootTakes :takes :selected :locale @select="emit('select', $event)" />
  </section>
</template>
