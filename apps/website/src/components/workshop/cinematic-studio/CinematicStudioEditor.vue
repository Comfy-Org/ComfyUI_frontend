<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import RunLeaveDialog from '@/components/workshop/RunLeaveDialog.vue'
import AppEditorShell from '@/components/workshop/app-editor/AppEditorShell.vue'
import { useCinematicLeaveGuard } from '@/composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '@/composables/useCinematicPopover'
import { useCinematicShot } from '@/composables/useCinematicShot'
import { reportStudioBusy } from '@/composables/useStudioSwitchGuard'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { workshopAppRepo } from '@/lib/workshop/apps'
import type { CinematicModel } from '@/lib/workshop/cinematic-studio/models'
import { selectedTake } from '@/lib/workshop/cinematic-studio/reel'
import { findStarter } from '@/lib/workshop/cinematic-studio/starters'
import CinematicEditorStage from './CinematicEditorStage.vue'
import CinematicModeSwitch from './CinematicModeSwitch.vue'
import CinematicPanelFields from './CinematicPanelFields.vue'
import CinematicPanelRun from './CinematicPanelRun.vue'
import CinematicPicker from './CinematicPicker.vue'
import type { PickerKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'

const {
  models,
  showCredits = true,
  back,
  starter,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  showCredits?: boolean
  back?: { href: string; label: string }
  /** A starter shot to open with its scene and direction already set. */
  starter?: string
  locale?: Locale
}>()
const { t: tc } = translationsFor(locale)

const {
  studio,
  mode,
  modeModels,
  hasVideo,
  model,
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
  start,
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

const PICKER_TOP = 60
const PICKER_BOTTOM = 12
const panel = useTemplateRef<HTMLElement>('panel')
const anchorTop = ref(PICKER_TOP)

async function openPicker(key: PickerKey) {
  togglePicker(key)
  await nextTick()
  const trigger = panel.value
    ?.querySelector('[aria-haspopup="dialog"][aria-expanded="true"]')
    ?.getBoundingClientRect()
  const sheet = document
    .querySelector('[data-testid="cinematic-picker"]')
    ?.getBoundingClientRect()
  if (!trigger || !sheet) return
  const centered = trigger.top + trigger.height / 2 - sheet.height / 2
  const lowest = window.innerHeight - sheet.height - PICKER_BOTTOM
  anchorTop.value = Math.max(PICKER_TOP, Math.min(centered, lowest))
}

function generate() {
  closePicker()
  generateShot()
}

const finished = computed(() => {
  const take = selectedTake(studio.reel.value)
  return take?.status === 'done' ? take : undefined
})
const download = computed(() =>
  finished.value
    ? { href: finished.value.output.url, name: finished.value.output.fileName }
    : undefined
)

const panelLabels = computed(() => ({
  label: tc('cinematic.panel.label'),
  expand: tc('cinematic.sheet.expand'),
  collapse: tc('cinematic.sheet.collapse')
}))

onMounted(() => {
  document.documentElement.setAttribute('data-workshop-editor', '')
  const shot = findStarter(starter)
  if (shot) start(shot)
})
onBeforeUnmount(() =>
  document.documentElement.removeAttribute('data-workshop-editor')
)
</script>

<template>
  <AppEditorShell
    :title="tc('cinematic.title')"
    :tools-label="tc('cinematic.tools')"
    :repo="workshopAppRepo('studio')"
    :panel-labels="panelLabels"
    :show-dock="false"
    :download
    :back
    :locale
    data-testid="cinematic"
  >
    <CinematicEditorStage
      :reel="studio.reel.value"
      :aspect
      :models
      :member-workspace="memberWorkspace"
      :locale
      @select="studio.select"
      @retry="studio.retry"
    />

    <template #panel>
      <div ref="panel" class="flex flex-col gap-3 pb-4">
        <div class="flex min-h-11 items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-primary-warm-white">
            {{ tc('cinematic.panel.newShot') }}
          </h2>
          <CinematicModeSwitch
            v-if="hasVideo"
            v-model="mode"
            :disabled="studio.rendering.value"
            compact
            :locale
          />
        </div>
        <CinematicPanelFields
          v-model:model="modelSlug"
          v-model:scene="scene"
          v-model:enhance="enhance"
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
          :models="modeModels"
          :video
          :direction
          :open-picker="picker"
          :colors
          start-tile
          :locale
          @open="openPicker"
        />
      </div>
    </template>
    <template #panel-peek>
      <img
        v-if="model"
        :src="model.logo"
        alt=""
        class="size-5 shrink-0 brightness-0 invert"
      />
      <span class="min-w-0 flex-1 truncate text-xs text-primary-warm-white">
        {{ scene.trim() || tc('cinematic.scene.placeholder') }}
      </span>
      <span class="shrink-0 text-xs text-primary-warm-gray">{{ aspect }}</span>
    </template>
    <template #panel-footer>
      <CinematicPanelRun
        v-model:takes="takes"
        :scene
        :blocked
        :gate="studio.gate.value"
        :workspace-name="studio.session.value?.workspace.name"
        :rendering="studio.rendering.value"
        :estimate
        :credits="studio.credits.value"
        :show-credits="showCredits"
        :locale
        @generate="generate"
        @cancel="studio.cancel"
      />
    </template>
  </AppEditorShell>
  <div
    v-if="picker"
    class="fixed inset-0 z-50 bg-black/60 md:hidden"
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
        'fixed inset-x-0 bottom-0 z-50 max-h-[80svh] rounded-b-none md:top-(--anchor-top) md:right-3 md:bottom-auto md:left-[calc(var(--container-editor-panel)+1.5rem)] md:max-h-[calc(100svh-4.5rem)] md:rounded-b-2xl md:transition-[max-width] md:duration-300 md:ease-out',
        picker === 'camera' ? 'md:max-w-full' : 'md:max-w-120'
      )
    "
    :style="{ '--anchor-top': `${anchorTop}px` }"
    @choose="choose"
    @close="closePicker"
  />
  <RunLeaveDialog
    :open="leavingTo !== undefined"
    :locale
    @update:open="(value: boolean) => !value && stay()"
    @leave="leave"
  />
</template>
