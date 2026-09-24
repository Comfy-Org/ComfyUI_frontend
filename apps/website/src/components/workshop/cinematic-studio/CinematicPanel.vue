<script setup lang="ts">
import { ChevronDown, ChevronRight } from '@lucide/vue'
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
import type { StudioGate } from '../../../lib/workshop/cinematic-studio/gate'
import type { PromptSegment } from '../../../lib/workshop/cinematic-studio/prompt'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicModel } from '../../../lib/workshop/cinematic-studio/models'
import CinematicDirectionGrid from './CinematicDirectionGrid.vue'
import CinematicGenerateAction from './CinematicGenerateAction.vue'
import CinematicMenu from './CinematicMenu.vue'
import CinematicOptionIcon from './CinematicOptionIcon.vue'
import CinematicOutputControls from './CinematicOutputControls.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'
import CinematicSceneField from './CinematicSceneField.vue'
import type { PickerKey } from './picker-key'

const {
  models,
  promptSegments,
  gate,
  workspaceName,
  rendering,
  openPicker,
  locale = 'en'
} = defineProps<{
  models: readonly CinematicModel[]
  promptSegments: readonly PromptSegment[]
  gate: StudioGate
  workspaceName?: string
  rendering: boolean
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
    meta: model.provider,
    logo: model.logo
  }))
)
const model = computed(() =>
  models.find((candidate) => candidate.slug === modelSlug.value)
)
const cameraBody = computed(() => directionOption('body', direction.value))
const cameraSpecs = computed(() =>
  cameraGroups
    .slice(1)
    .map((group) => directionOption(group.part, direction.value))
    .filter((option) => option.id !== 'auto')
)
const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0
)
const labelClass =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const cardClass =
  'flex w-full items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 p-2.5 text-left transition-colors hover:border-primary-warm-white/50'
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
    <div class="flex flex-col divide-y divide-transparency-white-t8">
      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">
          {{ tc('cinematic.model.heading', locale) }}
        </h2>
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="tc('cinematic.model.heading', locale)"
          :trigger-class="cn(cardClass, 'h-12 gap-3 px-3')"
        >
          <img v-if="model" :src="model.logo" alt="" class="size-5" />
          <span class="flex-1 text-sm font-semibold text-primary-warm-white">
            {{ model?.name }}
          </span>
          <span class="text-xs text-primary-warm-gray">
            {{ model?.provider }}
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
        :prompt-segments="promptSegments"
        :locale
      />

      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">
          {{ tc('cinematic.section.camera', locale) }}
        </h2>
        <button
          type="button"
          :aria-expanded="openPicker === 'camera'"
          aria-haspopup="dialog"
          :class="
            cn(
              cardClass,
              openPicker === 'camera' && 'border-primary-warm-white'
            )
          "
          @click="emit('open', 'camera')"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-xl bg-transparency-white-t8 text-primary-warm-white"
          >
            <CinematicOptionIcon
              part="body"
              :option="direction.body"
              class="h-6 w-9"
            />
          </span>
          <span
            class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1"
          >
            <span
              class="text-sm font-semibold whitespace-nowrap text-primary-warm-white"
            >
              {{ tc(cameraBody.label, locale) }}
            </span>
            <span
              class="flex flex-wrap gap-1 text-[11px] text-primary-comfy-canvas"
            >
              <span
                v-for="spec in cameraSpecs"
                :key="spec.id"
                class="rounded-md bg-transparency-white-t8 px-1.5 py-0.5"
              >
                {{ tc(spec.label, locale) }}
              </span>
            </span>
          </span>
          <ChevronRight
            class="size-4 text-primary-warm-gray"
            aria-hidden="true"
          />
        </button>
      </section>

      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">
          {{ tc('cinematic.section.direction', locale) }}
        </h2>
        <CinematicDirectionGrid
          :direction
          :open-picker="openPicker"
          :locale
          @open="emit('open', $event)"
        />
      </section>

      <section class="flex flex-col gap-2.5 p-5">
        <div class="flex items-center justify-between">
          <h2 :class="labelClass">
            {{ tc('cinematic.section.references', locale) }}
          </h2>
          <span class="text-[11px] text-primary-warm-gray">
            {{ tc('cinematic.reference.optional', locale) }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
          <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
        </div>
      </section>
      <section class="flex flex-col gap-2.5 p-5">
        <h2 :class="labelClass">
          {{ tc('cinematic.section.output', locale) }}
        </h2>
        <CinematicOutputControls
          v-model:aspect="aspect"
          v-model:resolution="resolution"
          v-model:takes="takes"
          :locale
        />
      </section>
    </div>

    <footer
      class="sticky bottom-0 z-10 mt-auto flex flex-col gap-2.5 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
    >
      <CinematicGenerateAction
        :gate
        :workspace-name="workspaceName"
        :rendering
        :can-generate="canGenerate"
        wide
        :locale
        @generate="emit('generate')"
        @cancel="emit('cancel')"
      />
    </footer>
  </aside>
</template>
