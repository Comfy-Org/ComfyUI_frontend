<script setup lang="ts">
import { translationsFor } from '../../../i18n/translations'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicLeaveGuard } from '../../../composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import AppsBackLink from './AppsBackLink.vue'
import CinematicComposer from './CinematicComposer.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStage from './CinematicStage.vue'
import type { PickerKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'
import { referenceSlots } from './reference-kind'

const {
  models,
  showCredits = true,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  showCredits?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const {
  studio,
  mode,
  modeModels,
  hasVideo,
  model,
  video,
  duration,
  videoResolution,
  audio,
  firstFrame,
  lastFrame,
  sourceVideo,
  blocked,
  animate,
  useAsReference: useTake,
  modelSlug,
  scene,
  enhance,
  direction,
  aspect,
  aspects,
  resolution,
  takes,
  cast,
  colors,
  mainColor,
  estimate,
  memberWorkspace,
  choose,
  start: startShot,
  generate: generateShot
} = useCinematicShot(models)
reportStudioBusy(() => studio.rendering.value)
const {
  open: popover,
  toggle: togglePopover,
  close: closePopover
} = useCinematicPopover<PickerKey>()

const POPOVER_WIDTH: Readonly<Partial<Record<PickerKey, string>>> = {
  camera: 'lg:w-4xl'
}
const popoverClass = computed(() =>
  cn(
    'fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-full lg:left-0 lg:mb-3 lg:max-h-[60svh] lg:rounded-b-2xl',
    (popover.value && POPOVER_WIDTH[popover.value]) ?? 'lg:w-xl'
  )
)

const starter = ref<string>()

const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => studio.rendering.value,
  () => studio.cancel()
)

function focusScene() {
  document.getElementById('cinematic-scene')?.focus()
}

function start(shot: StarterShot) {
  starter.value = shot.id
  startShot(shot)
  focusScene()
}

const takeError = ref(false)

async function useAsReference(url: string, name: string) {
  takeError.value = !(await useTake(url, name))
}

const canAnimate = models.some((option) => !!option.firstFrameSlug)
async function animateTake(url: string, name: string) {
  closePopover()
  takeError.value = !(await animate(url, name))
  if (!takeError.value) focusScene()
}

function generate() {
  closePopover()
  generateShot()
}

function generateOn(slug: string) {
  modelSlug.value = slug
  generate()
}
</script>

<template>
  <div
    class="mb-12 flex min-h-[calc(100svh-5rem)] flex-col lg:mb-20 lg:min-h-[calc(100svh-7rem)]"
    data-testid="cinematic"
  >
    <AppsBackLink :locale class="mx-3 mt-4 sm:mx-6" />
    <CinematicStage
      :reel="studio.reel.value"
      :models
      :can-animate="canAnimate"
      :can-reference="mode === 'image'"
      :locale
      :starter
      :member-workspace="memberWorkspace"
      @select="studio.select"
      @start="start"
      @again="generate"
      @retry="studio.retry"
      @reference="useAsReference"
      @animate="animateTake"
      @switch-model="generateOn"
      @edit-scene="focusScene"
    />

    <div
      class="sticky bottom-0 z-50 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/90 to-transparent px-3 pt-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div class="relative mx-auto w-full max-w-7xl">
        <div
          v-if="popover"
          class="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
        <CinematicPicker
          v-if="popover"
          :key="popover"
          v-model:colors="colors"
          v-model:main-color="mainColor"
          :groups="pickerGroups(popover)"
          :direction
          :title="popoverTitle(popover, locale)"
          :locale
          :class="popoverClass"
          @choose="choose"
          @close="closePopover"
        />
        <p
          v-if="takeError"
          role="status"
          class="mb-2 text-xs text-primary-comfy-canvas"
        >
          {{ t('cinematic.references.unreadable') }}
        </p>
        <CinematicModeSwitch
          v-if="hasVideo"
          v-model="mode"
          :disabled="studio.rendering.value"
          :locale
          class="mb-3 w-fit"
        />
        <CinematicComposer
          v-model:scene="scene"
          v-model:model="modelSlug"
          v-model:takes="takes"
          v-model:aspect="aspect"
          v-model:resolution="resolution"
          v-model:enhance="enhance"
          v-model:cast="cast"
          v-model:first-frame="firstFrame"
          v-model:last-frame="lastFrame"
          v-model:source-video="sourceVideo"
          v-model:duration="duration"
          v-model:video-resolution="videoResolution"
          v-model:audio="audio"
          :models="modeModels"
          :aspects
          :slots="referenceSlots(model, !!firstFrame)"
          :colors
          :blocked
          :video
          :direction
          :gate="studio.gate.value"
          :workspace-name="studio.session.value?.workspace.name"
          :rendering="studio.rendering.value"
          :estimate
          :credits="studio.credits.value"
          :show-credits="showCredits"
          :open-popover="popover"
          :locale
          @open="togglePopover"
          @generate="generate"
          @cancel="studio.cancel"
        />
      </div>
    </div>

    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && stay()"
      @leave="leave"
    />
  </div>
</template>
