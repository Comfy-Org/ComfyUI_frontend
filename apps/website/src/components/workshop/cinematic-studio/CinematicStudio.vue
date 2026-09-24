<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useCinematicPopover } from '../../../composables/useCinematicPopover'
import { useCinematicShot } from '../../../composables/useCinematicShot'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { StarterShot } from '../../../lib/workshop/cinematic-studio/starters'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
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

function start(shot: StarterShot) {
  startShot(shot)
  document.getElementById('cinematic-scene')?.focus()
}

function generate() {
  closePopover()
  generateShot()
}
</script>

<template>
  <div
    class="flex min-h-[calc(100svh-5rem)] flex-col lg:min-h-[calc(100svh-7rem)]"
    data-testid="cinematic"
  >
    <div
      class="flex h-12 shrink-0 items-center gap-3 border-y border-transparency-white-t8 px-4 sm:px-8 lg:px-14"
    >
      <h1 class="text-sm font-semibold text-primary-warm-white sm:text-[15px]">
        {{ tc('cinematic.title', locale) }}
      </h1>
      <span
        class="rounded-full border border-transparency-white-t20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ tc('cinematic.beta', locale) }}
      </span>
      <p class="truncate text-[13px] text-primary-warm-gray max-sm:hidden">
        {{ tc('cinematic.tagline', locale) }}
      </p>
    </div>

    <CinematicStage
      :reel="studio.reel.value"
      :models
      :locale
      @select="studio.select"
      @start="start"
    />

    <div
      class="sticky bottom-0 z-30 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/90 to-transparent px-3 pt-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div class="relative mx-auto w-full max-w-6xl">
        <div
          v-if="popover"
          class="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
        <CinematicPicker
          v-if="popover && pickerGroups(popover).length"
          :key="popover"
          :groups="pickerGroups(popover)"
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
          :references="references.length"
          :gate="studio.gate.value"
          :workspace-name="studio.session.value?.workspace.name"
          :rendering="studio.rendering.value"
          :open-popover="popover"
          :locale
          @open="togglePopover"
          @generate="generate"
          @cancel="studio.cancel"
        />
      </div>
    </div>
  </div>
</template>
