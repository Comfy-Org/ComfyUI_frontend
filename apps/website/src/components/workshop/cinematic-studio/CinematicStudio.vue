<script setup lang="ts">
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicLeaveGuard } from '../../../composables/useCinematicLeaveGuard'
import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import { reportStudioBusy } from '../../../composables/useStudioSwitchGuard'
import type { DirectionPart } from '../../../lib/workshop/cinematic-studio/catalog'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import RunLeaveDialog from '../RunLeaveDialog.vue'
import AppsBackLink from './AppsBackLink.vue'
import CinematicComposer from './CinematicComposer.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicPicker from './CinematicPicker.vue'
import CinematicPopover from './CinematicPopover.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
import CinematicStage from './CinematicStage.vue'
import type { PopoverKey } from './picker-key'
import { pickerGroups, popoverTitle } from './picker-key'

const { models, locale = 'en' } = defineProps<{
  models: readonly CinematicModel[]
  locale?: Locale
}>()

const {
  studio,
  modelSlug,
  scene,
  enhance,
  direction,
  aspect,
  resolution,
  takes,
  cast,
  palette,
  references,
  choose,
  start: startShot,
  generate: generateShot
} = useCinematicShot(models)
reportStudioBusy(() => studio.rendering.value)
const {
  open: popover,
  toggle: togglePopover,
  close: closePopover
} = useCinematicPopover<PopoverKey>()

const POPOVER_WIDTH: Readonly<Partial<Record<PopoverKey, string>>> = {
  camera: 'lg:w-4xl',
  direction: 'lg:w-2xl',
  references: 'lg:w-96',
  format: 'lg:w-96'
}
const popoverClass = computed(() =>
  cn(
    'fixed inset-x-0 bottom-0 z-50 max-h-[85svh] rounded-b-none lg:absolute lg:inset-x-auto lg:bottom-full lg:left-0 lg:mb-3 lg:max-h-[60svh] lg:rounded-b-2xl',
    (popover.value && POPOVER_WIDTH[popover.value]) ?? 'lg:w-xl'
  )
)

const starter = ref<string>()

const directionStart = ref<DirectionPart>()

function openPopover(key: PopoverKey, part?: DirectionPart) {
  const switchingTab =
    key === 'direction' &&
    popover.value === 'direction' &&
    part !== directionStart.value
  directionStart.value = part
  if (!switchingTab) togglePopover(key)
}

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

async function useAsReference(url: string, name: string) {
  const response = await fetch(url)
  cast.value = new File([await response.blob()], name, {
    type: response.headers.get('content-type') ?? 'image/png'
  })
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
      :locale
      :starter
      @select="studio.select"
      @start="start"
      @again="generate"
      @reference="useAsReference"
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
          v-if="popover && pickerGroups(popover).length"
          :key="`${popover}-${directionStart}`"
          :groups="pickerGroups(popover)"
          :start="directionStart"
          :direction
          :title="popoverTitle(popover, locale)"
          :locale
          :class="popoverClass"
          @choose="choose"
          @close="closePopover"
        />
        <CinematicPopover
          v-else-if="popover"
          :key="popover"
          :title="popoverTitle(popover, locale)"
          :locale
          :class="popoverClass"
          @close="closePopover"
        >
          <div v-if="popover === 'references'" class="grid grid-cols-2 gap-2">
            <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
            <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
          </div>
          <div v-else class="flex flex-col gap-3">
            <CinematicOutputControls
              v-model:aspect="aspect"
              v-model:resolution="resolution"
              v-model:takes="takes"
              :locale
            />
            <label
              class="flex cursor-pointer items-center gap-2.5 rounded-xl px-1 text-xs text-primary-warm-white"
            >
              <input
                v-model="enhance"
                type="checkbox"
                role="switch"
                class="peer sr-only"
              />
              <span
                class="relative h-4 w-7 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-3 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-3"
                aria-hidden="true"
              />
              {{ tc('cinematic.scene.enhance', locale) }}
              <span class="truncate text-primary-warm-gray">
                {{ tc('cinematic.scene.enhanceHint', locale) }}
              </span>
            </label>
          </div>
        </CinematicPopover>
        <CinematicComposer
          v-model:scene="scene"
          v-model:model="modelSlug"
          :models
          :direction
          :aspect
          :resolution
          :takes
          :references
          :gate="studio.gate.value"
          :workspace-name="studio.session.value?.workspace.name"
          :rendering="studio.rendering.value"
          :open-popover="popover"
          :locale
          @open="openPopover"
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
