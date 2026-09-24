<script setup lang="ts">
import { ChevronDown, Clapperboard, Film, Frame, Plus, Sun } from '@lucide/vue'
import type { Component } from 'vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  LookPart,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  directionOption,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import type { PopoverKey } from './picker-key'

const {
  models,
  direction,
  aspect,
  resolution,
  takes,
  references,
  gate,
  workspaceName,
  rendering,
  openPopover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  direction: Direction
  aspect: AspectRatio
  resolution: Resolution
  takes: number
  references: number
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  openPopover?: PopoverKey
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: PopoverKey]
  generate: []
  cancel: []
}>()

const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const modelSlug = defineModel<string>('model', { required: true })

const LOOK_ICONS: Readonly<Record<LookPart, Component>> = {
  shot: Frame,
  light: Sun,
  film: Film,
  look: Clapperboard
}

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    meta: model.provider,
    logo: model.logo
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)
const cameraLabel = computed(() => {
  const body = directionOption('body', direction)
  const focal = directionOption('focal', direction)
  return [body, focal]
    .filter((option) => option.id !== 'auto')
    .map((option) => tc(option.label, locale))
    .join(' · ')
})
const lookChips = computed(() =>
  lookGroups.map((group) => {
    const option = directionOption(group.part, direction)
    return {
      key: group.part,
      icon: LOOK_ICONS[group.part],
      label: tc(option.id === 'auto' ? group.title : option.label, locale)
    }
  })
)
const grade = computed(() => directionOption('grade', direction))
const formatLabel = computed(() => `${aspect} · ${resolution} · ×${takes}`)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0
)

function generateFromKeyboard() {
  if (canGenerate.value && !rendering) emit('generate')
}

const chipClass = (key: PopoverKey) =>
  cn(
    'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] whitespace-nowrap text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t8 hover:text-primary-warm-white',
    openPopover === key &&
      'bg-transparency-white-t8 text-primary-warm-white ring-1 ring-transparency-white-t20 ring-inset'
  )
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div
      class="flex w-full flex-col gap-2.5 rounded-3xl border border-transparency-white-t8 bg-primary-comfy-ink-light p-3 shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
      role="group"
      :aria-label="tc('cinematic.composer.label', locale)"
    >
      <div class="flex items-start gap-2.5 px-1 pt-0.5">
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'references'"
          :aria-label="tc('cinematic.composer.references', locale)"
          :class="
            cn(
              'relative grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-transparency-white-t20 text-primary-comfy-canvas hover:border-primary-warm-white/50 hover:text-primary-warm-white',
              openPopover === 'references' && 'border-primary-warm-white'
            )
          "
          @click="emit('open', 'references')"
        >
          <Plus class="size-4" aria-hidden="true" />
          <span
            v-if="references"
            class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-comfy-yellow text-[10px] font-bold text-primary-comfy-ink"
          >
            {{ references }}
          </span>
        </button>
        <label for="cinematic-scene" class="sr-only">
          {{ tc('cinematic.section.scene', locale) }}
        </label>
        <textarea
          id="cinematic-scene"
          v-model="scene"
          rows="2"
          :placeholder="tc('cinematic.scene.placeholder', locale)"
          class="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent pt-1 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
          @keydown.enter.meta.prevent="generateFromKeyboard"
          @keydown.enter.ctrl.prevent="generateFromKeyboard"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <div
          class="-mx-1 scrollbar-hide flex min-w-0 flex-1 basis-full items-center gap-0.5 overflow-x-auto px-1 lg:basis-auto lg:flex-wrap lg:overflow-visible"
        >
          <CinematicMenu
            v-model="modelSlug"
            :options="modelOptions"
            :heading="tc('cinematic.model.heading', locale)"
            trigger-class="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-[13px] whitespace-nowrap text-primary-warm-white hover:bg-transparency-white-t8"
          >
            <img
              v-if="model"
              :src="model.logo"
              alt=""
              class="size-3.5"
              aria-hidden="true"
            />
            {{ model?.name }}
            <ChevronDown
              class="size-3 text-primary-warm-gray"
              aria-hidden="true"
            />
          </CinematicMenu>
          <span
            class="mx-1 h-4.5 w-px shrink-0 bg-transparency-white-t20"
            aria-hidden="true"
          />
          <button
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPopover === 'camera'"
            :class="chipClass('camera')"
            @click="emit('open', 'camera')"
          >
            <CinematicOptionIcon
              part="body"
              :option="direction.body"
              class="h-3.5 w-6"
            />
            {{ cameraLabel || tc('cinematic.section.camera', locale) }}
          </button>
          <button
            v-for="chip in lookChips"
            :key="chip.key"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPopover === chip.key"
            :class="chipClass(chip.key)"
            @click="emit('open', chip.key)"
          >
            <component :is="chip.icon" class="size-3.5" aria-hidden="true" />
            {{ chip.label }}
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPopover === 'grade'"
            :class="chipClass('grade')"
            @click="emit('open', 'grade')"
          >
            <span
              v-if="grade.palette"
              class="flex h-3 w-6 overflow-hidden rounded-xs"
              aria-hidden="true"
            >
              <span
                v-for="(color, index) in grade.palette"
                :key="index"
                class="h-full flex-1"
                :style="{ backgroundColor: color }"
              />
            </span>
            {{
              tc(grade.id === 'auto' ? gradeGroup.title : grade.label, locale)
            }}
          </button>
        </div>
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'format'"
          :aria-label="`${tc('cinematic.composer.format', locale)}: ${formatLabel}`"
          :class="cn(chipClass('format'), 'font-mono text-xs')"
          @click="emit('open', 'format')"
        >
          {{ formatLabel }}
        </button>
        <CinematicGenerateAction
          :gate
          :workspace-name="workspaceName"
          :rendering
          :can-generate="canGenerate"
          :locale
          class="ml-auto"
          @generate="emit('generate')"
          @cancel="emit('cancel')"
        />
      </div>
    </div>
    <label
      class="flex cursor-pointer items-center gap-2 text-xs text-primary-warm-gray"
    >
      <input
        v-model="enhance"
        type="checkbox"
        role="switch"
        class="peer sr-only"
      />
      <span
        class="relative h-3.5 w-6 shrink-0 rounded-full bg-transparency-white-t20 transition-colors peer-checked:bg-primary-comfy-yellow peer-focus-visible:ring-3 peer-focus-visible:ring-primary-comfy-yellow/50 after:absolute after:top-0.5 after:left-0.5 after:size-2.5 after:rounded-full after:bg-primary-comfy-ink after:transition-transform peer-checked:after:translate-x-2.5"
        aria-hidden="true"
      />
      {{ tc('cinematic.scene.enhance', locale) }}
      <span class="max-sm:hidden">
        · {{ tc('cinematic.scene.enhanceHint', locale) }}
      </span>
    </label>
  </div>
</template>
