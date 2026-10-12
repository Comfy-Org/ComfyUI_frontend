<script setup lang="ts">
import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { computed } from 'vue'

import { useReshoot } from '@/composables/useReshoot'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import { DEFAULT_CAMERA } from '@/lib/workshop/cinematic-studio/reshoot'
import type { Locale } from '@/i18n/translations'
import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import AppsBackLink from '@/components/workshop/cinematic-studio/AppsBackLink.vue'
import ReshootHeader from './ReshootHeader.vue'
import ReshootSide from './ReshootSide.vue'
import ReshootStage from './ReshootStage.vue'
import { currentStep } from './steps'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

// Reading the scene and every take run on the Comfy app proxy. The scene is
// read as soon as the page opens or a clip is uploaded; the camera is then
// aimed against a live warp of the clip's own geometry.
const reshoot = useReshoot({ locale })
const {
  upload,
  clip,
  clipName,
  isExample,
  aspect,
  size,
  depth,
  stage,
  notice,
  frames,
  clipError,
  geometry,
  step,
  view,
  pose,
  onKey,
  keepAim,
  frame,
  keys,
  motion,
  prompt,
  seed,
  takes,
  selected,
  current,
  gate,
  canGenerate,
  priceNote,
  session
} = reshoot

const { rendering, camera } = reshoot
const aimed = computed(
  () =>
    keys.value.length > 0 ||
    (Object.keys(DEFAULT_CAMERA) as (keyof typeof DEFAULT_CAMERA)[]).some(
      (axis) => camera[axis] !== DEFAULT_CAMERA[axis]
    )
)
const progress = computed(() =>
  currentStep({
    depth: depth.value,
    selected: selected.value,
    aimed: aimed.value
  })
)

reportStudioBusy(() => reshoot.rendering.value)
const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => reshoot.rendering.value,
  () => reshoot.cancel()
)
</script>

<template>
  <div
    class="mx-auto mb-12 max-w-10xl px-4 py-8 sm:px-8 lg:mb-20 lg:px-14"
    data-testid="reshoot"
  >
    <AppsBackLink :locale class="mb-5" />
    <ReshootHeader :locale class="mb-6" />
    <div
      class="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <ReshootSide
        v-model:upload="upload"
        v-model:aspect="aspect"
        v-model:size="size"
        v-model:seed="seed"
        v-model:keep-aim="keepAim"
        v-model:frame="frame"
        v-model:prompt="prompt"
        :clip
        :clip-name="clipName"
        :is-example="isExample"
        :camera="view"
        :keys
        :depth
        :frames
        :clip-error="clipError"
        :error="depth === 'failed' ? notice : undefined"
        :notice="depth === 'failed' ? undefined : notice"
        :step="progress"
        :rendering
        :gate
        :can-generate="canGenerate"
        :price-note="priceNote"
        :workspace-name="session?.workspace.name"
        :locale
        @aim="reshoot.aim"
        @remove-key="reshoot.removeKey"
        @analyze="reshoot.analyze"
        @generate="reshoot.generate"
        @cancel="reshoot.cancel"
        @example="reshoot.showExample"
      />
      <ReshootStage
        v-model:frame="frame"
        v-model:motion="motion"
        :clip
        :camera="view"
        :depth
        :stage
        :notice="depth === 'failed' ? undefined : notice"
        :step
        :takes
        :selected
        :current
        :geometry
        :pose
        :keep-aim="keepAim"
        :keys
        :keyed="onKey"
        :locale
        class="lg:sticky lg:top-26 lg:self-start"
        @aim="reshoot.aim"
        @select="selected = $event"
        @reuse="reshoot.reuse(selected)"
        @key="reshoot.toggleKey"
        @clear-keys="keys = []"
      />
    </div>
    <RunLeaveDialog
      :open="leavingTo !== undefined"
      :locale
      @update:open="(value: boolean) => !value && stay()"
      @leave="leave"
    />
  </div>
</template>
