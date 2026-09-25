<script setup lang="ts">
import { ref } from 'vue'

import { useCinematicPopover } from '../../../../composables/useCinematicPopover'
import { useReshootDemo } from '../../../../composables/useReshootDemo'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import type { Locale } from '../../../../i18n/translations'
import AppsBackLink from '../AppsBackLink.vue'
import CinematicPopover from '../CinematicPopover.vue'
import ReshootAim from './ReshootAim.vue'
import ReshootClipControls from './ReshootClipControls.vue'
import ReshootComposer from './ReshootComposer.vue'
import ReshootPick from './ReshootPick.vue'
import ReshootStage from './ReshootStage.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const {
  upload,
  clip,
  clipName,
  isExample,
  picked,
  aspect,
  size,
  depth,
  step,
  camera,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current,
  rendering,
  pick,
  generate,
  cancel,
  aim,
  addKey,
  removeKey,
  resetCamera
} = useReshootDemo({ autoRead: true })
const { open: popover, toggle, close } = useCinematicPopover<'clip'>()

const aiming = ref(false)

function start(file?: File) {
  pick(file)
  aiming.value = true
}

function openAim() {
  close()
  selected.value = 'aim'
  aiming.value = true
}

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
    <div class="flex flex-1 flex-col gap-4 px-3 pt-4 sm:px-6">
      <AppsBackLink :locale />
      <ReshootPick v-if="!picked" :locale @pick="start" />
      <ReshootAim
        v-else-if="aiming"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:motion="motion"
        :clip
        :camera
        :keys
        :depth
        :locale
        @aim="aim"
        @key="addKey"
        @remove-key="removeKey"
        @clear-keys="keys = []"
        @reset="resetCamera"
        @apply="aiming = false"
      />
      <ReshootStage
        v-else
        :clip
        :camera
        :depth
        :step
        :takes
        :selected
        :current
        :locale
        @aim="aim"
        @select="selected = $event"
      />
    </div>
    <div
      v-if="picked && !aiming"
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
          :title="rc('reshoot.section.video', locale)"
          :locale
          class="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-full lg:left-0 lg:mb-3 lg:max-h-[60svh] lg:w-96 lg:rounded-b-2xl"
          @close="close"
        >
          <ReshootClipControls
            v-model:upload="upload"
            v-model:aspect="aspect"
            v-model:size="size"
            v-model:seed="seed"
            :clip
            :clip-name="clipName"
            :is-example="isExample"
            :locale
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
          :clip-open="popover === 'clip'"
          :locale
          @clip="toggle('clip')"
          @aim="openAim"
          @generate="run(generate)"
          @cancel="cancel"
        />
      </div>
    </div>
    <p class="mt-2 px-3 text-center text-[11px] text-primary-warm-gray">
      {{ rc('reshoot.credit', locale) }} ·
      {{ rc('reshoot.demoNote', locale) }}
    </p>
  </div>
</template>
