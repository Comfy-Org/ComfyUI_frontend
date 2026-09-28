<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  cameraGroups,
  directionOption
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import CinematicDirectionSegments from './CinematicDirectionSegments.vue'
import CinematicEnhanceSwitch from './CinematicEnhanceSwitch.vue'
import CinematicFormatSegments from './CinematicFormatSegments.vue'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import CinematicReferenceMenu from './CinematicReferenceMenu.vue'
import CinematicTooltip from './CinematicTooltip.vue'
import type { PickerKey } from './picker-key'

const {
  models,
  direction,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  showCredits = true,
  openPopover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  direction: Direction
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  showCredits?: boolean
  openPopover?: PickerKey
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: PickerKey]
  generate: []
  cancel: []
}>()

const scene = defineModel<string>('scene', { required: true })
const modelSlug = defineModel<string>('model', { required: true })
const takes = defineModel<number>('takes', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const cast = defineModel<File | undefined>('cast')
const palette = defineModel<File | undefined>('palette')

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    logo: model.logo,
    meta: model.degraded ? tc('cinematic.model.degraded', locale) : undefined
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)

const bodyLabel = computed(() =>
  tc(directionOption('body', direction).label, locale)
)
const cameraSummary = computed(
  () =>
    `${tc('cinematic.section.camera', locale)}: ${cameraGroups
      .map((group) => tc(directionOption(group.part, direction).label, locale))
      .join(' · ')}`
)
const focalLabel = computed(() => {
  const focal = directionOption('focal', direction)
  return focal.id === 'auto' ? undefined : tc(focal.label, locale)
})
const blockedNote = computed(() =>
  (cast.value || palette.value) && !model.value?.referenceSlug
    ? tc('cinematic.references.unsupported', locale).replace(
        '{model}',
        model.value?.name ?? ''
      )
    : undefined
)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0 && !blockedNote.value
)

function generateFromKeyboard() {
  if (canGenerate.value && !rendering) emit('generate')
}

const chipClass = (key: PickerKey) =>
  cn(
    'flex h-9 max-w-80 shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-comfy-canvas ring-1 ring-transparency-white-t8 transition-colors ring-inset hover:bg-transparency-white-t4 hover:text-primary-warm-white',
    openPopover === key &&
      'bg-transparency-white-t8 text-primary-warm-white ring-transparency-white-t20'
  )
</script>

<template>
  <div
    class="flex w-full flex-col overflow-hidden rounded-3xl border border-transparency-white-t8 bg-primary-comfy-ink-light shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
    role="group"
    :aria-label="tc('cinematic.composer.label', locale)"
  >
    <div class="flex items-start gap-2.5 px-4 pt-3.5 pb-3">
      <CinematicReferenceMenu
        v-model:cast="cast"
        v-model:palette="palette"
        :locale
      />
      <label for="cinematic-scene" class="sr-only">
        {{ tc('cinematic.section.scene', locale) }}
      </label>
      <textarea
        id="cinematic-scene"
        v-model="scene"
        rows="1"
        :placeholder="tc('cinematic.scene.placeholder', locale)"
        class="field-sizing-content max-h-[calc(4lh+0.375rem)] min-h-9 flex-1 resize-none bg-transparent pt-1.5 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        @keydown.enter.meta.prevent="generateFromKeyboard"
        @keydown.enter.ctrl.prevent="generateFromKeyboard"
      />
      <CinematicEnhanceSwitch
        v-model="enhance"
        :locale
        class="h-9 shrink-0 text-primary-comfy-canvas"
      />
    </div>

    <div
      class="flex flex-wrap items-center gap-2 border-t border-transparency-white-t8 px-3 py-2.5"
    >
      <div
        class="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-2 py-0.5 sm:basis-auto"
      >
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="tc('cinematic.model.heading', locale)"
          tooltip
          trigger-class="h-9 shrink-0 gap-2 rounded-xl px-3 text-[13px] whitespace-nowrap text-primary-warm-white hover:bg-transparency-white-t8"
        >
          <img
            v-if="model"
            :src="model.logo"
            alt=""
            class="size-4 brightness-0 invert"
          />
          {{ model?.name }}
          <ChevronDown
            class="size-3 text-primary-warm-gray"
            aria-hidden="true"
          />
        </CinematicMenu>
        <CinematicTooltip :text="cameraSummary">
          <button
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPopover === 'camera'"
            :aria-label="cameraSummary"
            :class="chipClass('camera')"
            @click="emit('open', 'camera')"
          >
            <CinematicOptionIcon
              part="body"
              :option="direction.body"
              class="h-6 w-10 shrink-0"
            />
            <span class="tabular-nums">{{ focalLabel ?? bodyLabel }}</span>
          </button>
        </CinematicTooltip>
        <CinematicDirectionSegments
          :direction
          :open="openPopover"
          :locale
          @open="emit('open', $event)"
        />
        <CinematicFormatSegments
          v-model:aspect="aspect"
          v-model:resolution="resolution"
          v-model:takes="takes"
          :locale
        />
      </div>
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        :blocked-note="blockedNote"
        :estimate
        :credits
        :show-credits="showCredits"
        :locale
        class="ml-auto"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
        @reduce-takes="takes = $event"
      />
    </div>
  </div>
</template>
