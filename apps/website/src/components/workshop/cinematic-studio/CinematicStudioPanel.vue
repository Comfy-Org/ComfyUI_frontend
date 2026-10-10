<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '@/composables/useCinematicPopover'
import { useCinematicShot } from '@/composables/useCinematicShot'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import { workshopAppRepo } from '@/lib/workshop/apps'
import { CINEMATIC_STUDIO_APP_SLUG } from '@/lib/workshop/cinematic-studio/analytics'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
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
  showCredits = true,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  showCredits?: boolean
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

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
  colors,
  mainColor,
  estimate,
  memberWorkspace,
  choose,
  generate: generateShot
} = useCinematicShot(models)
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

const editingPalette = ref(false)
watch(picker, () => (editingPalette.value = false))

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
  generateShot()
  output.value?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-4 py-8 sm:px-8 lg:px-14"
    data-testid="cinematic"
  >
    <AppsBackLink :locale class="mb-5" />
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <h1 class="text-2xl font-semibold text-primary-warm-white lg:text-3xl">
        {{ tc('cinematic.title') }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.beta') }}
      </span>
    </div>
    <div
      class="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-lg text-primary-warm-gray">
        {{ tc('cinematic.lead') }}
      </p>
      <AppRepoLink
        :repo="workshopAppRepo('studio')"
        :app-slug="CINEMATIC_STUDIO_APP_SLUG"
        :locale
        class="shrink-0"
      />
    </div>
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
        v-model:duration="duration"
        v-model:video-resolution="videoResolution"
        v-model:audio="audio"
        v-model:first-frame="firstFrame"
        v-model:last-frame="lastFrame"
        v-model:source-video="sourceVideo"
        :colors
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
      >
        <template #mode>
          <CinematicModeSwitch
            v-if="hasVideo"
            v-model="mode"
            :disabled="studio.rendering.value"
            compact
            :locale
          />
        </template>
      </CinematicPanel>
      <div
        ref="output"
        class="relative flex min-w-0 flex-col lg:sticky lg:top-26 lg:self-start"
      >
        <CinematicStageCard
          :reel="studio.reel.value"
          :aspect
          :models
          :member-workspace="memberWorkspace"
          :locale
          @select="studio.select"
          @retry="studio.retry"
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
        v-model:colors="colors"
        v-model:main-color="mainColor"
        v-model:editing="editingPalette"
        :groups="pickerGroups(picker)"
        :direction
        :title="popoverTitle(picker, locale)"
        :locale
        :class="
          cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[80svh] rounded-b-none lg:absolute lg:top-(--anchor-top) lg:right-0 lg:bottom-auto lg:left-[calc((100%-1.5rem)*0.4+1.5rem)] lg:z-20 lg:max-h-[calc(100svh-8rem)] lg:rounded-b-2xl lg:transition-[max-width] lg:duration-300 lg:ease-out',
            picker === 'camera' ? 'lg:max-w-full' : 'lg:max-w-120'
          )
        "
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
