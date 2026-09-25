<script setup lang="ts">
import { computed, inject, ref, shallowRef, watch } from 'vue'
import {
  generationTimingNamespaceKey,
  readGenerationTimings
} from '../../../lib/workshop/cinematic-studio/generation-timings'
import { videoDurationGuidance } from '../../../lib/workshop/cinematic-studio/model-capabilities';
import type { ModelCapability } from '../../../lib/workshop/cinematic-studio/model-capabilities';
import { modelGuidanceCopy } from '../../../lib/workshop/cinematic-studio/model-guidance-copy'
import type { CinematicCatalogEntry } from '../../../lib/workshop/cinematic-studio/model-catalog'
import type { Locale } from '../../../i18n/translations'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import Button from '../../ui/button/Button.vue'
import Dialog from '../../ui/dialog/Dialog.vue'
import DialogContent from '../../ui/dialog/DialogContent.vue'
import DialogTitle from '../../ui/dialog/DialogTitle.vue'
import DialogDescription from '../../ui/dialog/DialogDescription.vue'

const {
  entries,
  selectable,
  locale = 'en'
} = defineProps<{
  entries: readonly CinematicCatalogEntry[]
  selectable: readonly string[]
  locale?: Locale
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ select: [slug: string]; returnFocus: [] }>()
const search = ref('')
const modality = ref('all')
const guidanceCopy = computed(() => modelGuidanceCopy(locale))
const durationGuidance = computed(() =>
  Object.fromEntries(
    entries.map((entry) => [
      entry.slug,
      videoDurationGuidance(entry.capabilities, locale)
    ])
  )
)
const timingNamespace = inject(generationTimingNamespaceKey, undefined)
const timings = shallowRef<
  Record<string, { count: number; median: number; min: number; max: number }>
>({})
watch(
  [open, () => timingNamespace?.value],
  () => {
    timings.value = {}
    const scope = timingNamespace?.value
    if (!open.value || !scope) return
    timings.value = Object.fromEntries(
      entries.flatMap((entry) => {
        const values = readGenerationTimings(scope, entry.slug)
          .map((sample) => sample.elapsedMs)
          .sort((a, b) => a - b)
        if (!values.length) return []
        const middle = Math.floor(values.length / 2)
        return [
          [
            entry.slug,
            {
              count: values.length,
              median:
                values.length % 2
                  ? values[middle]
                  : (values[middle - 1] + values[middle]) / 2,
              min: values[0],
              max: values[values.length - 1]
            }
          ]
        ]
      })
    )
  },
  { immediate: true }
)
function seconds(ms: number) {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'short',
    maximumFractionDigits: 0
  }).format(ms / 1000)
}
function capabilityValue(row: ModelCapability) {
  if (row.kind === 'duration')
    return videoDurationGuidance([row], locale).supported
  return row.values
    .map((value) => {
      if (row.kind === 'firstFrame' || row.kind === 'lastFrame') {
        switch (value) {
          case 'required':
            return tc('cinematic.capability.required', locale)
          case 'optional':
            return tc('cinematic.capability.optional', locale)
          case 'supported':
            return tc('cinematic.capability.supported', locale)
          case 'unsupported':
            return tc('cinematic.capability.unsupported', locale)
        }
      }
      if (
        row.kind === 'inputs' &&
        ['text', 'image', 'video', 'audio'].includes(value)
      ) {
        switch (value) {
          case 'text':
            return tc('cinematic.catalog.text', locale)
          case 'image':
            return tc('cinematic.catalog.image', locale)
          case 'video':
            return tc('cinematic.catalog.video', locale)
          case 'audio':
            return tc('cinematic.catalog.audio', locale)
        }
      }
      if (row.kind === 'quality' && value === 'std')
        return tc('cinematic.video.standard', locale)
      if (row.kind === 'quality' && value === 'pro')
        return tc('cinematic.video.professional', locale)
      if (row.kind === 'audio' && ['on', 'true'].includes(value))
        return tc('cinematic.video.audioOn', locale)
      if (row.kind === 'audio' && ['off', 'false'].includes(value))
        return tc('cinematic.video.audioOff', locale)
      return value
    })
    .join(' / ')
}
const modalities = [
  'all',
  'image',
  'video',
  'audio',
  '3d',
  'text',
  'other'
] as const
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      (modality.value === 'all' || entry.modality === modality.value) &&
      `${entry.name} ${entry.provider} ${entry.routerId}`
        .toLowerCase()
        .includes(query)
  )
})
function select(slug: string) {
  emit('select', slug)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex max-h-[90dvh] flex-col gap-4 sm:max-w-3xl"
      :close-label="tc('cinematic.catalog.close', locale)"
      @close-auto-focus.prevent="emit('returnFocus')"
    >
      <DialogTitle class="pr-10">{{
        tc('cinematic.catalog.title', locale)
      }}</DialogTitle>
      <DialogDescription>{{
        tc('cinematic.catalog.description', locale)
      }}</DialogDescription>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm text-primary-warm-white">
          {{ tc('cinematic.catalog.search', locale) }}
          <input
            v-model="search"
            type="search"
            class="min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink p-2"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-primary-warm-white">
          {{ tc('cinematic.catalog.type', locale) }}
          <select
            v-model="modality"
            class="min-w-0 rounded-lg border border-transparency-white-t20 bg-primary-comfy-ink p-2"
          >
            <option v-for="kind in modalities" :key="kind" :value="kind">
              {{ tc(`cinematic.catalog.${kind}`, locale) }}
            </option>
          </select>
        </label>
      </div>
      <p role="status" class="text-sm text-primary-warm-gray">
        {{ filtered.length }} / {{ entries.length }}
      </p>
      <div
        class="min-h-0 overflow-y-auto"
        data-testid="cinematic-model-catalog-results"
      >
        <p v-if="!filtered.length" class="py-6 text-primary-warm-gray">
          {{ tc('cinematic.catalog.empty', locale) }}
        </p>
        <ul class="space-y-2">
          <li
            v-for="entry in filtered"
            :key="entry.slug"
            class="flex flex-col gap-3 rounded-xl border border-transparency-white-t8 p-3 sm:flex-row sm:items-center"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium wrap-break-word text-primary-warm-white">
                {{ entry.name }}
              </p>
              <p class="text-xs text-primary-warm-gray">
                {{ entry.provider }} ·
                {{ tc(`cinematic.catalog.${entry.modality}`, locale) }}
              </p>
              <p class="text-xs wrap-break-word text-primary-warm-gray">
                {{ entry.routerId }}
              </p>
              <p class="mt-1 text-xs text-primary-comfy-canvas">
                {{
                  tc(
                    selectable.includes(entry.slug)
                      ? 'cinematic.catalog.studio'
                      : entry.runnable
                        ? 'cinematic.catalog.native'
                        : 'cinematic.catalog.unavailable',
                    locale
                  )
                }}
              </p>
              <div
                v-if="entry.modality === 'video'"
                class="mt-3 space-y-1 text-sm text-primary-warm-white"
              >
                <p>
                  <span class="text-primary-warm-gray"
                    >{{ guidanceCopy.clipLength }}:</span
                  >
                  {{ durationGuidance[entry.slug].supported }}
                </p>
                <p
                  v-if="durationGuidance[entry.slug].suggestion"
                  class="text-primary-comfy-yellow"
                >
                  {{ durationGuidance[entry.slug].suggestion }}
                </p>
                <p
                  v-if="durationGuidance[entry.slug].suggestion"
                  class="text-xs text-primary-warm-gray"
                >
                  {{ guidanceCopy.suggestionNote }}
                </p>
              </div>
              <details class="mt-3 text-sm text-primary-warm-white">
                <summary
                  class="cursor-pointer rounded-lg border border-transparency-white-t20 px-3 py-2 text-primary-comfy-yellow"
                >
                  {{ guidanceCopy.details }}
                </summary>
                <dl class="mt-3 grid grid-cols-1 gap-2 text-xs">
                  <div v-for="row in entry.capabilities" :key="row.kind">
                    <dt class="text-primary-warm-gray">
                      {{ tc(`cinematic.capability.${row.kind}`, locale) }}
                    </dt>
                    <dd class="mt-0.5 wrap-break-word">
                      {{ capabilityValue(row) }}
                    </dd>
                  </div>
                </dl>
                <p
                  v-if="!entry.capabilities.length"
                  class="mt-2 text-xs text-primary-warm-gray"
                >
                  {{ tc('cinematic.capability.unknown', locale) }}
                </p>
                <p class="mt-2 text-xs text-primary-warm-gray">
                  {{ tc('cinematic.capability.note', locale) }}
                </p>
                <div class="mt-3 border-t border-transparency-white-t8 pt-3">
                  <p class="font-medium">
                    {{ guidanceCopy.waitTime }}
                  </p>
                  <template v-if="timings[entry.slug]">
                    <p class="mt-1">
                      {{
                        tc(
                          timings[entry.slug].count >= 3
                            ? 'cinematic.timing.typical'
                            : 'cinematic.timing.observed',
                          locale
                        )
                      }}: {{ seconds(timings[entry.slug].median) }}
                    </p>
                    <p class="mt-1 text-xs text-primary-warm-gray">
                      {{ tc('cinematic.timing.range', locale) }}:
                      {{ seconds(timings[entry.slug].min) }} –
                      {{ seconds(timings[entry.slug].max) }} ·
                      {{ timings[entry.slug].count }}
                      {{ tc('cinematic.timing.runs', locale) }}
                    </p>
                  </template>
                  <p v-else class="mt-1">
                    {{ tc('cinematic.timing.unmeasured', locale) }}
                  </p>
                  <p class="mt-2 text-xs text-primary-warm-gray">
                    {{ tc('cinematic.timing.note', locale) }}
                  </p>
                </div>
              </details>
            </div>
            <Button
              v-if="selectable.includes(entry.slug)"
              variant="outline"
              @click="select(entry.slug)"
              >{{ tc('cinematic.catalog.use', locale) }}</Button
            >
            <a
              v-else
              :href="entry.href"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-lg border border-transparency-white-t20 px-3 py-2 text-center text-sm text-primary-comfy-yellow underline-offset-4 hover:underline"
              >{{ tc('cinematic.catalog.open', locale) }} ↗</a
            >
          </li>
        </ul>
      </div>
    </DialogContent>
  </Dialog>
</template>
