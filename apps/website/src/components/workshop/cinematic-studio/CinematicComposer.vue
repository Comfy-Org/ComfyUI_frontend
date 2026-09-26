<script setup lang="ts">
import { ChevronDown, Plus } from '@lucide/vue'
import { useObjectUrl } from '@vueuse/core'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  DirectionPart,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import { directionOption } from '../../../lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { framedStyle } from './aspect-style'
import CinematicDirectionChips from './CinematicDirectionChips.vue'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import type { PopoverKey } from './picker-key'

const {
  models,
  direction,
  aspect,
  resolution,
  references,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  openPopover,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  direction: Direction
  aspect: AspectRatio
  resolution: Resolution
  references: readonly File[]
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  openPopover?: PopoverKey
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: PopoverKey, part?: DirectionPart]
  generate: []
  cancel: []
}>()

const scene = defineModel<string>('scene', { required: true })
const modelSlug = defineModel<string>('model', { required: true })
const takes = defineModel<number>('takes', { required: true })

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
const focalLabel = computed(() => {
  const focal = directionOption('focal', direction)
  return focal.id === 'auto' ? undefined : tc(focal.label, locale)
})
const referencePreview = useObjectUrl(() => references[0])
const blockedNote = computed(() =>
  references.length > 0 && !model.value?.referenceSlug
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

const chipClass = (key: PopoverKey) =>
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
      <button
        type="button"
        aria-haspopup="dialog"
        :aria-expanded="openPopover === 'references'"
        :aria-label="tc('cinematic.composer.references', locale)"
        :class="
          cn(
            'relative grid size-9 shrink-0 place-items-center overflow-visible rounded-xl border border-dashed border-transparency-white-t20 text-primary-comfy-canvas hover:border-primary-warm-white/50 hover:text-primary-warm-white',
            openPopover === 'references' && 'border-primary-warm-white',
            referencePreview && 'border-solid'
          )
        "
        @click="emit('open', 'references')"
      >
        <img
          v-if="referencePreview"
          :src="referencePreview"
          alt=""
          class="size-full rounded-[inherit] object-cover"
        />
        <Plus v-else class="size-4" aria-hidden="true" />
        <span
          v-if="references.length > 1"
          class="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary-comfy-yellow text-[10px] font-bold text-primary-comfy-ink"
        >
          {{ references.length }}
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
        class="field-sizing-content max-h-40 min-h-11 flex-1 resize-none bg-transparent pt-1.5 text-base/relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
        @keydown.enter.meta.prevent="generateFromKeyboard"
        @keydown.enter.ctrl.prevent="generateFromKeyboard"
      />
    </div>

    <div
      class="flex flex-wrap items-center gap-2 border-t border-transparency-white-t8 px-3 py-2.5"
    >
      <div
        class="-mx-1 scrollbar-hide flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:basis-auto"
      >
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="tc('cinematic.model.heading', locale)"
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
            class="h-4 w-7 shrink-0"
          />
          {{ bodyLabel }}
          <span v-if="focalLabel" class="text-primary-warm-gray">
            {{ focalLabel }}
          </span>
        </button>
        <CinematicDirectionChips
          :direction
          :open="openPopover === 'direction'"
          :locale
          @open="emit('open', 'direction')"
        />
        <button
          type="button"
          aria-haspopup="dialog"
          :aria-expanded="openPopover === 'format'"
          :aria-label="`${tc('cinematic.composer.format', locale)}: ${aspect}, ${resolution}, ×${takes}`"
          :class="cn(chipClass('format'), 'gap-0 px-0')"
          @click="emit('open', 'format')"
        >
          <span class="flex items-center gap-2 px-3">
            <span class="grid size-4 place-items-center" aria-hidden="true">
              <span
                class="block max-h-full rounded-xs border-[1.5px] border-current"
                :style="framedStyle(aspect, '1rem')"
              />
            </span>
            {{ aspect }}
          </span>
          <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
          <span class="px-3">{{ resolution }}</span>
          <span class="h-4 w-px bg-transparency-white-t8" aria-hidden="true" />
          <span class="px-3">×{{ takes }}</span>
        </button>
      </div>
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        :blocked-note="blockedNote"
        :estimate
        :credits
        :locale
        class="ml-auto"
        @generate="emit('generate')"
        @cancel="emit('cancel')"
        @reduce-takes="takes = $event"
      />
    </div>
  </div>
</template>
