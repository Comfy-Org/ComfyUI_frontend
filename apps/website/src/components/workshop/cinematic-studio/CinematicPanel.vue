<script setup lang="ts">
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Maximize,
  Minus,
  Plus,
  RectangleHorizontal
} from '@lucide/vue'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import type { StudioGate } from '../../../composables/useCinematicStudioRun'
import { useSignInHref } from '../../../composables/useSignInHref'
import { requestWorkshopBuyCredits } from '../../../config/workshop-buy-credits'
import { leaveForSignIn } from '../../../config/workshop-return'
import type {
  AspectRatio,
  CinematicModel,
  Direction,
  LookPart,
  Resolution
} from '../../../lib/workshop/cinematic-studio/catalog'
import {
  ASPECT_RATIOS,
  MAX_TAKES,
  RESOLUTIONS,
  cameraGroups,
  directionOption,
  gradeGroup,
  lookGroups
} from '../../../lib/workshop/cinematic-studio/catalog'
import type { PromptSegment } from '../../../lib/workshop/cinematic-studio/prompt'
import type { Locale } from '../../../i18n/translations'
import { t, tPlural } from '../../../i18n/translations'
import CinematicMenu from './CinematicMenu.vue'
import CinematicReferenceSlot from './CinematicReferenceSlot.vue'

export type PickerKey = 'camera' | LookPart | 'grade'

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

const modelSlug = defineModel<string>('modelSlug', { required: true })
const scene = defineModel<string>('scene', { required: true })
const enhance = defineModel<boolean>('enhance', { required: true })
const direction = defineModel<Direction>('direction', { required: true })
const aspect = defineModel<AspectRatio>('aspect', { required: true })
const resolution = defineModel<Resolution>('resolution', { required: true })
const takes = defineModel<number>('takes', { required: true })
const cast = defineModel<File | undefined>('cast')
const palette = defineModel<File | undefined>('palette')

const showFullPrompt = ref(false)
const signInHref = useSignInHref(locale)

const model = computed(
  () =>
    models.find((candidate) => candidate.slug === modelSlug.value) ?? models[0]
)
const modelOptions = computed(() =>
  models.map((candidate) => ({
    id: candidate.slug,
    label: candidate.name,
    meta: candidate.provider,
    logo: candidate.logo
  }))
)
const aspectOptions = computed(() =>
  ASPECT_RATIOS.map((ratio) => ({
    id: ratio.id,
    label: ratio.id,
    meta: t(ratio.label, locale)
  }))
)
const resolutionOptions = RESOLUTIONS.map((option) => ({
  id: option.id,
  label: option.id
}))

const aspectValue = computed({
  get: () => aspect.value,
  set: (id: string) => {
    const match = ASPECT_RATIOS.find((ratio) => ratio.id === id)
    if (match) aspect.value = match.id
  }
})
const resolutionValue = computed({
  get: () => resolution.value,
  set: (id: string) => {
    const match = RESOLUTIONS.find((option) => option.id === id)
    if (match) resolution.value = match.id
  }
})

const cameraBody = computed(() => directionOption('body', direction.value))
const cameraSpecs = computed(() =>
  cameraGroups
    .slice(1)
    .map((group) => directionOption(group.part, direction.value))
    .filter((option) => option.id !== 'auto')
)
const tiles = computed(() =>
  lookGroups.map((group) => ({
    key: group.part,
    title: t(group.title, locale),
    option: directionOption(group.part, direction.value)
  }))
)
const grade = computed(() => directionOption('grade', direction.value))

const canGenerate = computed(
  () => gate === 'ready' && scene.value.trim().length > 0
)
const labelClass =
  'text-[11px] font-bold tracking-widest text-primary-warm-gray uppercase'
const cardClass =
  'flex w-full items-center gap-3 rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 p-2.5 text-left transition-colors hover:border-primary-warm-white/50'
const segmentClass: Record<PromptSegment['source'], string> = {
  scene: 'text-primary-warm-white',
  direction: 'text-primary-comfy-canvas',
  enhance: 'text-primary-warm-gray',
  reference: 'text-primary-warm-gray'
}
</script>

<template>
  <aside
    :aria-label="t('cinematic.panel.label', locale)"
    class="flex h-full w-[380px] shrink-0 flex-col border-r border-transparency-white-t8 bg-primary-comfy-ink"
  >
    <div
      class="flex flex-1 flex-col divide-y divide-transparency-white-t8 overflow-y-auto"
    >
      <section class="flex flex-col gap-2.5 p-4">
        <h2 :class="labelClass">{{ t('cinematic.section.model', locale) }}</h2>
        <CinematicMenu
          v-model="modelSlug"
          :options="modelOptions"
          :heading="t('cinematic.model.heading', locale)"
          side="bottom"
          :trigger-class="cardClass"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-xl bg-transparency-white-t8"
          >
            <img :src="model.logo" alt="" class="size-5" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              class="truncate text-sm font-semibold text-primary-warm-white"
            >
              {{ model.name }}
            </span>
            <span class="truncate text-xs text-primary-warm-gray">
              {{ model.provider }} · {{ t('cinematic.model.router', locale) }}
            </span>
          </span>
          <ChevronDown
            class="size-4 text-primary-warm-gray"
            aria-hidden="true"
          />
        </CinematicMenu>
      </section>

      <section class="flex flex-col gap-2.5 p-4">
        <div class="flex items-center justify-between">
          <label for="cinematic-scene" :class="labelClass">
            {{ t('cinematic.section.scene', locale) }}
          </label>
          <button
            type="button"
            class="text-xs text-primary-comfy-canvas underline underline-offset-4 hover:text-primary-warm-white"
            :aria-pressed="showFullPrompt"
            @click="showFullPrompt = !showFullPrompt"
          >
            {{
              t(
                showFullPrompt
                  ? 'cinematic.scene.edit'
                  : 'cinematic.scene.fullPrompt',
                locale
              )
            }}
          </button>
        </div>
        <div
          class="flex flex-col rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 focus-within:border-primary-warm-white/60"
        >
          <p
            v-if="showFullPrompt"
            class="h-28 overflow-y-auto px-3.5 pt-3 pb-2 text-sm leading-relaxed"
            data-testid="cinematic-full-prompt"
          >
            <span
              v-for="(segment, index) in promptSegments"
              :key="index"
              :class="cn('me-1', segmentClass[segment.source])"
              >{{ segment.text }}</span
            >
          </p>
          <textarea
            v-else
            id="cinematic-scene"
            v-model="scene"
            rows="4"
            :placeholder="t('cinematic.scene.placeholder', locale)"
            class="h-28 resize-none bg-transparent px-3.5 pt-3 text-sm leading-relaxed text-primary-warm-white outline-none placeholder:text-primary-warm-gray"
          />
          <label
            class="flex cursor-pointer items-center gap-2.5 border-t border-transparency-white-t8 px-3.5 py-2.5 text-xs text-primary-warm-white"
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
            {{ t('cinematic.scene.enhance', locale) }}
            <span class="truncate text-primary-warm-gray">
              {{ t('cinematic.scene.enhanceHint', locale) }}
            </span>
          </label>
        </div>
      </section>

      <section class="flex flex-col gap-2.5 p-4">
        <h2 :class="labelClass">{{ t('cinematic.section.camera', locale) }}</h2>
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
            <Camera class="size-5" aria-hidden="true" />
          </span>
          <span class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-sm font-semibold text-primary-warm-white">
              {{ t(cameraBody.label, locale) }}
            </span>
            <span
              class="flex flex-wrap gap-1 text-[11px] text-primary-comfy-canvas"
            >
              <span
                v-for="spec in cameraSpecs"
                :key="spec.id"
                class="rounded-md bg-transparency-white-t8 px-1.5 py-0.5"
              >
                {{ t(spec.label, locale) }}
              </span>
            </span>
          </span>
          <ChevronRight
            class="size-4 text-primary-warm-gray"
            aria-hidden="true"
          />
        </button>
      </section>

      <section class="flex flex-col gap-2.5 p-4">
        <h2 :class="labelClass">
          {{ t('cinematic.section.direction', locale) }}
        </h2>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="tile in tiles"
            :key="tile.key"
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPicker === tile.key"
            :class="
              cn(
                'group relative flex aspect-8/5 flex-col justify-end overflow-hidden rounded-xl bg-transparency-white-t4 p-2.5 text-left ring-1 ring-transparency-white-t20 ring-inset hover:ring-primary-warm-white/50',
                openPicker === tile.key && 'ring-2 ring-primary-warm-white'
              )
            "
            @click="emit('open', tile.key)"
          >
            <img
              v-if="tile.option.preview"
              :src="tile.option.preview"
              alt=""
              class="absolute inset-0 size-full object-cover opacity-75 transition-opacity group-hover:opacity-100"
            />
            <span
              class="absolute inset-0 bg-linear-to-t from-primary-comfy-ink via-primary-comfy-ink/30 to-transparent"
              aria-hidden="true"
            />
            <span
              class="relative text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
            >
              {{ tile.title }}
            </span>
            <span
              class="relative truncate text-sm font-semibold text-primary-warm-white"
            >
              {{ t(tile.option.label, locale) }}
            </span>
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            :aria-expanded="openPicker === 'grade'"
            :class="
              cn(
                'col-span-2 flex items-center gap-3 rounded-xl bg-transparency-white-t4 p-2 text-left ring-1 ring-transparency-white-t20 ring-inset hover:ring-primary-warm-white/50',
                openPicker === 'grade' && 'ring-2 ring-primary-warm-white'
              )
            "
            @click="emit('open', 'grade')"
          >
            <span class="flex h-8 w-24 shrink-0 overflow-hidden rounded-lg">
              <span
                v-for="(color, index) in grade.palette"
                :key="index"
                class="h-full flex-1"
                :style="{ backgroundColor: color }"
              />
            </span>
            <span class="flex min-w-0 flex-1 flex-col">
              <span
                class="text-[10px] font-bold tracking-widest text-primary-comfy-canvas uppercase"
              >
                {{ t(gradeGroup.title, locale) }}
              </span>
              <span
                class="truncate text-sm font-semibold text-primary-warm-white"
              >
                {{ t(grade.label, locale) }}
              </span>
            </span>
            <ChevronRight
              class="size-4 text-primary-warm-gray"
              aria-hidden="true"
            />
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-2.5 p-4">
        <div class="flex items-center justify-between">
          <h2 :class="labelClass">
            {{ t('cinematic.section.references', locale) }}
          </h2>
          <span class="text-[11px] text-primary-warm-gray">
            {{ t('cinematic.reference.optional', locale) }}
          </span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <CinematicReferenceSlot v-model="cast" kind="cast" :locale />
          <CinematicReferenceSlot v-model="palette" kind="palette" :locale />
        </div>
      </section>
    </div>

    <footer
      class="flex flex-col gap-2.5 border-t border-transparency-white-t8 bg-primary-comfy-ink p-4"
    >
      <div class="grid grid-cols-[auto_1fr_1fr] gap-2">
        <div
          class="flex h-10 items-center rounded-xl border border-transparency-white-t20"
          role="group"
          :aria-label="t('cinematic.output.takes', locale)"
        >
          <button
            type="button"
            class="grid size-9 place-items-center text-primary-warm-gray hover:text-primary-warm-white disabled:opacity-40"
            :disabled="takes <= 1"
            :aria-label="t('cinematic.output.fewerTakes', locale)"
            @click="takes = takes - 1"
          >
            <Minus class="size-3.5" aria-hidden="true" />
          </button>
          <span
            class="w-4 text-center text-sm text-primary-warm-white tabular-nums"
          >
            {{ takes }}
          </span>
          <button
            type="button"
            class="grid size-9 place-items-center text-primary-warm-gray hover:text-primary-warm-white disabled:opacity-40"
            :disabled="takes >= MAX_TAKES"
            :aria-label="t('cinematic.output.moreTakes', locale)"
            @click="takes = takes + 1"
          >
            <Plus class="size-3.5" aria-hidden="true" />
          </button>
        </div>
        <CinematicMenu
          v-model="aspectValue"
          :options="aspectOptions"
          :heading="t('cinematic.output.aspect', locale)"
          trigger-class="h-10 justify-center gap-1.5 border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
        >
          <RectangleHorizontal
            class="size-3.5 text-primary-warm-gray"
            aria-hidden="true"
          />
          {{ aspect }}
        </CinematicMenu>
        <CinematicMenu
          v-model="resolutionValue"
          :options="resolutionOptions"
          :heading="t('cinematic.output.resolution', locale)"
          trigger-class="h-10 justify-center gap-1.5 border border-transparency-white-t20 text-sm text-primary-warm-white hover:border-primary-warm-white/50"
        >
          <Maximize
            class="size-3.5 text-primary-warm-gray"
            aria-hidden="true"
          />
          {{ resolution }}
        </CinematicMenu>
      </div>

      <Button
        v-if="gate === 'signedOut'"
        as="a"
        :href="signInHref"
        class="h-12 w-full"
        @click="leaveForSignIn($event, signInHref)"
      >
        {{ t('workshop.run.signIn', locale) }}
      </Button>
      <template v-else-if="gate === 'noCredits'">
        <p class="text-xs text-content-secondary">
          {{
            t('workshop.error.noCreditsCloud', locale).replace(
              '{workspace}',
              () => workspaceName ?? ''
            )
          }}
        </p>
        <Button class="h-12 w-full" @click="requestWorkshopBuyCredits">
          {{ t('workshop.run.buyCredits', locale) }}
        </Button>
      </template>
      <p
        v-else-if="gate === 'memberNoCredits'"
        class="text-xs text-content-secondary"
      >
        {{
          t('workshop.error.memberNoCredits', locale).replace(
            '{workspace}',
            () => workspaceName ?? ''
          )
        }}
      </p>
      <Button
        v-else-if="rendering"
        variant="outline"
        class="h-12 w-full"
        @click="emit('cancel')"
      >
        {{ t('cinematic.output.cancel', locale) }}
      </Button>
      <Button
        v-else
        class="h-12 w-full justify-between px-5"
        :disabled="!canGenerate"
        data-testid="cinematic-generate"
        @click="emit('generate')"
      >
        {{ t('cinematic.output.generate', locale) }}
        <span class="text-xs font-bold tracking-wider">
          {{ tPlural('cinematic.output.takeCount', takes, locale) }}
        </span>
      </Button>
      <p v-if="gate === 'unavailable'" class="text-xs text-primary-warm-gray">
        {{ t('cinematic.output.unavailable', locale) }}
      </p>
    </footer>
  </aside>
</template>
