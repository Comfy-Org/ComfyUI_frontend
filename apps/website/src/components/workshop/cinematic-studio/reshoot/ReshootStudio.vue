<script setup lang="ts">
import { computed } from 'vue'

import { useCinematicPopover } from '../../../../composables/useCinematicPopover'
import { useReshootDemo } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import CinematicPopover from '../CinematicPopover.vue'
import ReshootCameraControls from './ReshootCameraControls.vue'
import ReshootClipControls from './ReshootClipControls.vue'
import ReshootComposer from './ReshootComposer.vue'
import ReshootMoveControls from './ReshootMoveControls.vue'
import ReshootStage from './ReshootStage.vue'
import type { ReshootPopover } from './popover'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const {
  upload,
  clip,
  clipName,
  isExample,
  aspect,
  size,
  depth,
  camera,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  takes,
  selected,
  current,
  rendering,
  analyze,
  generate,
  cancel,
  aim,
  addKey,
  removeKey
} = useReshootDemo()
const { open: popover, toggle, close } = useCinematicPopover<ReshootPopover>()

const TITLE = {
  clip: 'reshoot.section.video',
  camera: 'reshoot.section.camera',
  move: 'reshoot.section.move'
} as const
const aimLocked = computed(() => depth.value !== 'ready')

function run(action: () => void) {
  close()
  action()
}
</script>

<template>
  <div
    class="mb-12 flex min-h-[calc(100svh-5rem)] flex-col lg:mb-20 lg:min-h-[calc(100svh-7rem)]"
    data-testid="reshoot"
  >
    <div class="flex flex-1 flex-col px-3 pt-6 sm:px-6">
      <ReshootStage
        :clip
        :camera
        :depth
        :takes
        :selected
        :current
        :locale
        @aim="aim"
        @select="selected = $event"
      />
    </div>
    <div
      class="sticky bottom-0 z-50 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/90 to-transparent px-3 pt-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div class="relative mx-auto w-full max-w-5xl">
        <div
          v-if="popover"
          class="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
        <CinematicPopover
          v-if="popover"
          :key="popover"
          :title="rc(TITLE[popover], locale)"
          :locale
          class="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-full lg:left-0 lg:mb-3 lg:max-h-[60svh] lg:w-96 lg:rounded-b-2xl"
          @close="close"
        >
          <ReshootClipControls
            v-if="popover === 'clip'"
            v-model:upload="upload"
            v-model:aspect="aspect"
            v-model:size="size"
            :clip
            :clip-name="clipName"
            :is-example="isExample"
            :locale
          />
          <ReshootCameraControls
            v-else-if="popover === 'camera'"
            v-model:keep-aim="keepAim"
            :camera
            :disabled="aimLocked"
            :locale
            @aim="aim"
          />
          <ReshootMoveControls
            v-else
            v-model:frame="frame"
            v-model:motion="motion"
            :keys
            :disabled="aimLocked"
            :locale
            @key="addKey"
            @remove="removeKey"
            @clear="keys = []"
          />
        </CinematicPopover>
        <ReshootComposer
          v-model:prompt="prompt"
          :clip
          :camera
          :key-count="keys.length"
          :aspect
          :size
          :depth
          :rendering
          :open-popover="popover"
          :locale
          @open="toggle"
          @analyze="run(analyze)"
          @generate="run(generate)"
          @cancel="cancel"
        />
        <p class="mt-2 text-center text-[11px] text-primary-warm-gray">
          {{ rc('reshoot.demoNote', locale) }}
        </p>
      </div>
    </div>
  </div>
</template>
