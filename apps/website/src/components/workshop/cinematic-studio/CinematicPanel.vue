<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type {
  AspectRatio,
  Direction,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { ShotEstimate } from '../../../lib/workshop/cinematic-studio/estimate'
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import {
  shotAspects,
  takesReferences
} from '../../../lib/workshop/cinematic-studio/models'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
import CinematicSceneField from './CinematicSceneField.vue'
import CinematicShotList from './CinematicShotList.vue'
import type { PickerKey } from './picker-key'

const {
  models,
  gate,
  workspaceName,
  rendering,
  estimate,
  credits,
  showCredits = true,
  openPicker,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
  estimate?: ShotEstimate
  credits?: number
  showCredits?: boolean
  openPicker?: PickerKey
  locale?: Locale
}>()

const emit = defineEmits<{
  open: [key: PickerKey]
  generate: []
  cancel: []
}>()

const modelSlug = defineModel<string>('model', { required: true })
const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const direction = defineModel<Direction>('direction', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })
const cast = defineModel<File | undefined>('cast')
const palette = defineModel<File | undefined>('palette')

const modelOptions = computed(() =>
  models.map((model) => ({
    id: model.slug,
    label: model.name,
    logo: model.logo
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)
const blockedNote = computed(() =>
  !takesReferences(
    model.value,
    [cast.value, palette.value].filter(Boolean).length
  )
    ? tc('cinematic.references.unsupported', locale, {
        model: model.value?.name ?? ''
      })
    : undefined
)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0 && !blockedNote.value
)
const labelClass = 'text-xs font-medium text-primary-warm-gray'
const cardClass =
  'flex w-full items-center gap-3 rounded-2xl border border-transparency-white-t8 p-2.5 text-left transition-colors hover:border-transparency-white-t20'
</script>

<template>
  <aside
    :aria-label="tc('cinematic.panel.label', locale)"
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
  >
    <header
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.input.title', locale) }}
    </header>
    <div class="flex flex-col gap-5 p-4">
      <section class="flex flex-col gap-2">
        <h2 :class="labelClass">
          {{ tc('cinematic.model.heading', locale) }}
        </h2>
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="tc('cinematic.model.heading', locale)"
          side="bottom"
          :trigger-class="cn(cardClass, 'h-11 gap-3 px-3')"
        >
          <img
            v-if="model"
            :src="model.logo"
            alt=""
            class="size-5 brightness-0 invert"
          />
          <span class="flex-1 text-sm font-semibold text-primary-warm-white">
            {{ model?.name }}
          </span>
          <ChevronDown
            class="size-4 text-primary-warm-gray"
            aria-hidden="true"
          />
        </CinematicMenu>
      </section>
      <CinematicSceneField
        v-model:scene="scene"
        v-model:enhance="enhance"
        :locale
      />
      <section class="flex flex-col gap-2">
        <h2 :class="labelClass">
          {{ tc('cinematic.section.shot', locale) }}
        </h2>
        <CinematicShotList
          :direction
          :open-picker="openPicker"
          :locale
          @open="emit('open', $event)"
        />
      </section>
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 :class="labelClass">
            {{ tc('cinematic.section.references', locale) }}
          </h2>
          <span class="text-xs text-primary-warm-gray">
            {{ tc('cinematic.reference.optional', locale) }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
          <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
        </div>
      </section>
      <section class="flex flex-col gap-2">
        <h2 :class="labelClass">
          {{ tc('cinematic.section.output', locale) }}
        </h2>
        <CinematicOutputControls
          v-model:aspect="aspect"
          v-model:resolution="resolution"
          v-model:takes="takes"
          :aspects="shotAspects(model, !!(cast || palette))"
          :locale
        />
      </section>
    </div>

    <footer
      class="mt-auto flex flex-col gap-2.5 rounded-b-2xl border-t border-transparency-white-t8 p-3"
    >
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        :blocked-note="blockedNote"
        :estimate
        :credits
        wide
        :show-credits="showCredits"
        :locale
        @generate="emit('generate')"
        @cancel="emit('cancel')"
        @reduce-takes="takes = $event"
      />
    </footer>
  </aside>
</template>
