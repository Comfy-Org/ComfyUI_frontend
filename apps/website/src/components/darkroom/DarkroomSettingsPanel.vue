<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { shapeLabel } from '@/lib/darkroom/chips'
import { freshSeed } from '@/lib/darkroom/request'
import type { DarkroomSettings } from '@/lib/darkroom/vocabulary'
import {
  creativityKey,
  DARKROOM_FORMATS,
  DARKROOM_MODELS,
  DARKROOM_PLANNING,
  DARKROOM_SHAPES,
  DARKROOM_SIZES,
  darkroomModel,
  planningKey
} from '@/lib/darkroom/vocabulary'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

import DarkroomSegment from './DarkroomSegment.vue'

const { maxRuns, locale = 'en' } = defineProps<{
  /** The most images one prompt may make for this account. */
  maxRuns: number
  locale?: Locale
}>()
const settings = defineModel<DarkroomSettings>({ required: true })
const emit = defineEmits<{ close: []; reset: [] }>()
const { t } = translationsFor(locale)

function set<K extends keyof DarkroomSettings>(
  key: K,
  value: DarkroomSettings[K]
) {
  settings.value = { ...settings.value, [key]: value }
}

function valueOf(event: Event): string {
  const field = event.target
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement
    ? field.value
    : ''
}

const model = computed(() => darkroomModel(settings.value.model))
// An account that runs one image at a time is not shown a choice it lacks.
const runOptions = computed(() =>
  Array.from({ length: maxRuns }, (_, index) => ({
    value: index + 1,
    label: String(index + 1),
    title: t('darkroom.settings.imagesTip', { count: index + 1 }, index + 1)
  }))
)
const sizeOptions = DARKROOM_SIZES.map((size) => ({
  value: size,
  label: size,
  title: t(`darkroom.sizes.${size}`)
}))
const planningOptions = DARKROOM_PLANNING.map((level) => ({
  value: level.value,
  label: t(`darkroom.planning.${level.key}`)
}))
const formatOptions = DARKROOM_FORMATS.map((format) => ({
  value: format.value,
  label: format.label
}))
const shapes = DARKROOM_SHAPES.map((shape) => {
  const [width, height] =
    shape.value === 'auto' ? [1, 1] : shape.value.split(':').map(Number)
  const side = 26
  return {
    ...shape,
    name: t(`darkroom.shapes.${shape.key}`),
    detail:
      shape.value === 'auto' ? t('darkroom.shapes.fromRefs') : shape.value,
    title:
      shape.value === 'auto'
        ? t('darkroom.shapes.autoTitle')
        : `${t(`darkroom.shapes.${shape.key}`)} ${shape.value}`,
    width:
      width >= height ? side : Math.max(8, Math.round((side * width) / height)),
    height:
      width >= height ? Math.max(8, Math.round((side * height) / width)) : side
  }
})

const creativity = computed(() =>
  t(`darkroom.creativity.${creativityKey(settings.value.temperature)}`)
)
const changed = computed(() => {
  const s = settings.value
  return [
    s.temperature !== 1 &&
      t('darkroom.settings.changed.creativity', {
        word: creativity.value.toLowerCase()
      }),
    s.planning &&
      t('darkroom.chips.planning', {
        level: t(`darkroom.planning.${planningKey(s.planning)}`)
      }),
    s.seed !== '' && t('darkroom.chips.seed', { seed: s.seed }),
    s.format !== 'image/png' && 'JPEG',
    s.styleNotes.trim() && t('darkroom.chips.notes')
  ]
    .filter(Boolean)
    .join(', ')
})

const label =
  'mb-2.5 flex h-5 items-baseline gap-2.5 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const help = 'mt-2.5 max-w-md text-sm/snug text-content-muted'
const input =
  'h-11 w-full rounded-xl border border-transparency-white-t20 bg-transparency-white-t4 px-3.5 text-base text-primary-warm-white outline-none placeholder:text-primary-warm-gray focus:border-primary-warm-white/60'
</script>

<template>
  <div
    id="darkroom-settings"
    class="mx-auto mt-4 w-full max-w-10xl px-4 sm:px-8 lg:px-14"
  >
    <div
      class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    >
      <div
        class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('darkroom.prompt.settings') }}
      </div>
      <div class="px-5 pt-6 pb-4">
        <div
          class="grid grid-cols-1 items-start gap-x-12 gap-y-7 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,22rem)_auto_auto] xl:justify-start"
        >
          <div class="min-w-0 sm:col-span-2 xl:col-span-1">
            <label :class="label" for="darkroom-model">
              {{ t('darkroom.settings.model') }}
            </label>
            <select
              id="darkroom-model"
              :class="cn(input, 'cursor-pointer')"
              :value="settings.model"
              @change="set('model', valueOf($event))"
            >
              <option
                v-for="option in DARKROOM_MODELS"
                :key="option.id"
                :value="option.id"
              >
                {{ option.name }}
              </option>
            </select>
            <p v-if="model" :class="help">
              {{ t(`darkroom.models.${model.key}`) }}
            </p>
          </div>
          <div v-if="maxRuns > 1" class="min-w-0">
            <div :class="label">{{ t('darkroom.settings.images') }}</div>
            <DarkroomSegment
              :model-value="Math.min(settings.runs, maxRuns)"
              :options="runOptions"
              :label="t('darkroom.settings.images')"
              @update:model-value="(runs) => set('runs', runs)"
            />
            <p :class="help">{{ t('darkroom.settings.imagesHelp') }}</p>
          </div>
          <div class="min-w-0">
            <div :class="label">{{ t('darkroom.settings.resolution') }}</div>
            <DarkroomSegment
              :model-value="settings.size"
              :options="sizeOptions"
              :disabled="!!model?.noSize"
              :label="t('darkroom.settings.resolution')"
              @update:model-value="(size) => set('size', size)"
            />
            <p :class="help">
              {{
                model?.noSize
                  ? t('darkroom.settings.resolutionOff')
                  : t(`darkroom.sizes.${settings.size}`)
              }}
            </p>
          </div>
          <div class="col-span-full min-w-0">
            <div :class="label">
              {{ t('darkroom.settings.shape') }}
              <span
                class="text-sm font-normal tracking-normal text-primary-warm-white normal-case"
              >
                {{ shapeLabel(t, settings.shape) }}
              </span>
            </div>
            <div
              role="group"
              :aria-label="t('darkroom.settings.shape')"
              class="-mx-5 scrollbar-hide flex max-w-240 gap-2 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 xl:grid-cols-10"
            >
              <button
                v-for="shape in shapes"
                :key="shape.value"
                type="button"
                :title="shape.title"
                :aria-pressed="settings.shape === shape.value"
                :class="
                  cn(
                    'flex w-22 shrink-0 cursor-pointer flex-col items-center justify-end gap-1 rounded-xl border px-1 pt-2.5 pb-2 sm:w-auto',
                    settings.shape === shape.value
                      ? 'border-primary-warm-white bg-primary-warm-white text-primary-comfy-ink'
                      : 'border-transparency-white-t20 bg-site-bg-soft text-content hover:bg-transparency-white-t8 hover:text-primary-warm-white'
                  )
                "
                @click="set('shape', shape.value)"
              >
                <span class="flex h-7 items-center justify-center">
                  <span
                    :class="
                      cn(
                        'block rounded-xs border-[1.5px] border-current',
                        shape.value === 'auto' && 'border-dashed'
                      )
                    "
                    :style="{
                      width: `${shape.width}px`,
                      height: `${shape.height}px`
                    }"
                  />
                </span>
                <span
                  class="text-xs font-bold tracking-wide whitespace-nowrap uppercase"
                >
                  {{ shape.name }}
                </span>
                <span class="text-xs opacity-80">{{ shape.detail }}</span>
              </button>
            </div>
          </div>
        </div>

        <details
          class="group/more mt-7 border-t border-transparency-white-t8 pt-5"
        >
          <summary
            class="inline-flex cursor-pointer list-none items-center gap-2 py-1 text-xs font-bold tracking-wider text-primary-warm-white uppercase [&::-webkit-details-marker]:hidden"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
              class="size-3.5 transition-transform group-open/more:rotate-90"
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
            {{ t('darkroom.settings.more') }}
            <span
              v-if="changed"
              class="text-sm font-normal tracking-normal text-content-muted normal-case"
            >
              · {{ changed }}
            </span>
          </summary>
          <div
            class="mt-6 grid grid-cols-1 items-start gap-x-12 gap-y-7 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div class="min-w-0">
              <label
                :class="cn(label, 'justify-between')"
                for="darkroom-creativity"
              >
                {{ t('darkroom.settings.creativity') }}
                <span
                  class="text-sm font-normal tracking-normal text-primary-warm-white normal-case"
                >
                  {{ creativity }} · {{ settings.temperature.toFixed(2) }}
                </span>
              </label>
              <input
                id="darkroom-creativity"
                type="range"
                min="0"
                max="2"
                step="0.05"
                class="h-11 w-full accent-primary-comfy-canvas"
                :value="settings.temperature"
                @input="set('temperature', Number(valueOf($event)))"
              />
              <div
                class="-mt-1.5 flex justify-between text-xs text-content-muted"
              >
                <span>{{ t('darkroom.creativity.steady') }}</span>
                <span>{{ t('darkroom.creativity.wild') }}</span>
              </div>
              <p :class="help">{{ t('darkroom.settings.creativityHelp') }}</p>
            </div>
            <div class="min-w-0">
              <div :class="label">{{ t('darkroom.settings.planning') }}</div>
              <DarkroomSegment
                :model-value="settings.planning"
                :options="planningOptions"
                :label="t('darkroom.settings.planning')"
                @update:model-value="(planning) => set('planning', planning)"
              />
              <p :class="help">{{ t('darkroom.settings.planningHelp') }}</p>
            </div>
            <div class="min-w-0">
              <label :class="label" for="darkroom-seed">
                {{ t('darkroom.settings.seed') }}
              </label>
              <div class="flex max-w-sm gap-2">
                <input
                  id="darkroom-seed"
                  type="number"
                  min="0"
                  :class="cn(input, 'min-w-0 flex-1')"
                  :placeholder="t('darkroom.settings.seedPlaceholder')"
                  :value="settings.seed"
                  @input="set('seed', valueOf($event).replace(/\D/g, ''))"
                />
                <button
                  type="button"
                  class="h-11 shrink-0 cursor-pointer rounded-xl border border-transparency-white-t20 bg-site-bg-soft px-4 text-xs font-bold tracking-wider text-content uppercase hover:bg-transparency-white-t8 hover:text-primary-warm-white"
                  :title="t('darkroom.settings.seedPickTitle')"
                  @click="set('seed', String(freshSeed()))"
                >
                  {{ t('darkroom.settings.seedPick') }}
                </button>
              </div>
              <p :class="help">{{ t('darkroom.settings.seedHelp') }}</p>
            </div>
            <div class="min-w-0">
              <div :class="label">{{ t('darkroom.settings.format') }}</div>
              <DarkroomSegment
                :model-value="settings.format"
                :options="formatOptions"
                :label="t('darkroom.settings.format')"
                @update:model-value="(format) => set('format', format)"
              />
              <p :class="help">{{ t('darkroom.settings.formatHelp') }}</p>
            </div>
            <div class="min-w-0 sm:col-span-2">
              <label :class="label" for="darkroom-notes">
                {{ t('darkroom.settings.notes') }}
              </label>
              <input
                id="darkroom-notes"
                type="text"
                :class="input"
                :placeholder="t('darkroom.settings.notesPlaceholder')"
                :value="settings.styleNotes"
                @input="set('styleNotes', valueOf($event))"
              />
              <p :class="help">{{ t('darkroom.settings.notesHelp') }}</p>
            </div>
          </div>
        </details>

        <div
          class="mt-6 flex items-center justify-between border-t border-transparency-white-t8 pt-4"
        >
          <button
            type="button"
            class="cursor-pointer px-1 py-1.5 text-xs font-bold tracking-wider text-content-muted uppercase hover:text-primary-warm-white"
            @click="emit('reset')"
          >
            {{ t('darkroom.settings.reset') }}
          </button>
          <Button variant="ghost" size="sm" @click="emit('close')">
            {{ t('darkroom.settings.done') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
