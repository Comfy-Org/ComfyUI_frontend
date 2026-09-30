<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { useCinematicLeaveGuard } from '../../../composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import { workshopAppRepo } from '../../../lib/workshop/apps'
import type { WorkshopContract } from '../../../config/workshop-contract'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import type { CinematicCopyKey } from '../../../lib/workshop/cinematic-studio/copy'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import AppRepoLink from './AppRepoLink.vue'
import AppsBackLink from './AppsBackLink.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import CinematicPanel from './CinematicPanel.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicStageCard from './CinematicStageCard.vue'
import type { PickerKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'

const {
  models,
  enhanceContract,
  showCredits = true,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  enhanceContract?: WorkshopContract
  showCredits?: boolean
  locale?: Locale
}>()

const {
  studio,
  mode,
  modeModels,
  hasVideo,
  video,
  blocked,
  duration,
  videoResolution,
  audio,
  firstFrame,
  lastFrame,
  sourceVideo,
  modelSlug,
  scene,
  enhance,
  direction,
  aspect,
  resolution,
  takes,
  cast,
  palette,
  colors,
  mainColor,
  estimate,
  memberWorkspace,
  choose,
  animate,
  useAsReference: useTake,
  generate: generateShot
} = useCinematicShot(models, enhanceContract)
reportStudioBusy(() => studio.rendering.value)
const { leavingTo, leave, stay } = useCinematicLeaveGuard(
  () => studio.rendering.value,
  () => studio.cancel()
)
const {
  open: picker,
  toggle: togglePicker,
  close: closePicker
} = useCinematicPopover<PickerKey>()

const output = useTemplateRef<HTMLElement>('output')
const layout = useTemplateRef<HTMLElement>('layout')
const anchorTop = ref(0)

async function openPicker(key: PickerKey) {
  togglePicker(key)
  await nextTick()
  const trigger = layout.value
    ?.querySelector('[aria-haspopup="dialog"][aria-expanded="true"]')
    ?.getBoundingClientRect()
  const sheet = layout.value
    ?.querySelector('[data-testid="cinematic-picker"]')
    ?.getBoundingClientRect()
  const bounds = layout.value?.getBoundingClientRect()
  if (!trigger || !sheet || !bounds) return
  const centered =
    trigger.top + trigger.height / 2 - sheet.height / 2 - bounds.top
  anchorTop.value = Math.max(
    0,
    Math.min(centered, bounds.height - sheet.height)
  )
}

function generate() {
  closePicker()
  takeError.value = undefined
  generateShot()
  output.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}

const takeError = ref<CinematicCopyKey>()
watch(mode, () => (takeError.value = undefined))
function selectTake(id: string) {
  takeError.value = undefined
  studio.select(id)
}
async function useAsReference(url: string, name: string) {
  takeError.value = (await useTake(url, name))
    ? undefined
    : 'cinematic.references.unreadable'
}
const canAnimate = computed(() =>
  models.some((option) => !!option.firstFrameSlug)
)
async function animateTake(url: string, name: string) {
  closePicker()
  const animated = await animate(url, name)
  takeError.value = animated ? undefined : 'cinematic.video.frameError'
  if (animated) document.getElementById('cinematic-scene')?.focus()
}
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 py-8 sm:px-8 lg:px-14"
    data-testid="cinematic"
  >
    <AppsBackLink :locale class="mb-3" />
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold text-primary-warm-white lg:text-3xl">
        {{ tc('cinematic.title', locale) }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.beta', locale) }}
      </span>
      <AppRepoLink
        :repo="workshopAppRepo('studio')"
        :locale
        class="sm:ml-auto"
      />
    </div>
    <p class="-mt-3 mb-6 text-lg text-primary-warm-gray">
      {{ tc('cinematic.lead', locale) }}
    </p>
    <CinematicModeSwitch
      v-if="hasVideo"
      v-model="mode"
      :disabled="studio.rendering.value"
      :locale
      class="mb-4 w-fit"
    />
    <div
      ref="layout"
      class="relative grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
    >
      <CinematicPanel
        v-model:model="modelSlug"
        v-model:scene="scene"
        v-model:enhance="enhance"
        v-model:direction="direction"
        v-model:aspect="aspect"
        v-model:resolution="resolution"
        v-model:takes="takes"
        v-model:cast="cast"
        v-model:palette="palette"
        v-model:colors="colors"
        v-model:main-color="mainColor"
        v-model:duration="duration"
        v-model:video-resolution="videoResolution"
        v-model:audio="audio"
        v-model:first-frame="firstFrame"
        v-model:last-frame="lastFrame"
        v-model:source-video="sourceVideo"
        :models="modeModels"
        :blocked
        :video
        :gate="studio.gate.value"
        :workspace-name="studio.session.value?.workspace.name"
        :rendering="studio.rendering.value"
        :estimate
        :credits="studio.credits.value"
        :show-credits="showCredits"
        :open-picker="picker"
        :locale
        @open="openPicker"
        @generate="generate"
        @cancel="studio.cancel"
      />
      <div
        ref="output"
        class="relative flex min-w-0 flex-col lg:sticky lg:top-26 lg:self-start"
      >
        <p
          v-if="takeError"
          role="status"
          class="mb-2 text-xs text-primary-comfy-canvas"
        >
          {{ tc(takeError, locale) }}
        </p>
        <CinematicStageCard
          :reel="studio.reel.value"
          :aspect
          :models
          :member-workspace="memberWorkspace"
          :can-animate="canAnimate"
          :can-reference="mode === 'image'"
          :locale
          @select="selectTake"
          @retry="studio.retry"
          @again="generate"
          @reference="useAsReference"
          @animate="animateTake"
        />
      </div>
      <div
        v-if="picker"
        class="fixed inset-0 z-50 bg-black/60 lg:hidden"
        aria-hidden="true"
      />
      <CinematicPicker
        v-if="picker"
        :key="picker"
        :groups="pickerGroups(picker)"
        :direction
        :title="popoverTitle(picker, locale)"
        :locale
        class="fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:top-(--anchor-top) lg:right-0 lg:bottom-auto lg:left-[calc((100%-1.5rem)*0.4+1.5rem)] lg:z-20 lg:max-h-[calc(100svh-8rem)] lg:rounded-b-2xl"
        :style="{ '--anchor-top': `${anchorTop}px` }"
        @choose="choose"
        @close="closePicker"
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
