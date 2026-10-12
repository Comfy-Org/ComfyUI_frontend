<script setup lang="ts">
import { ChevronDown, Cpu, FileImage } from '@lucide/vue'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import type { CutoutMode } from '@/lib/workshop/background-removal/contract'
import {
  CUTOUT_FORMATS,
  CUTOUT_MODES,
  REPLACE_MODELS
} from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import { FORMAT_TRIGGER_CLASS } from '@/components/workshop/cinematic-studio/cinematic-menu-trigger'
import CinematicMenu from '@/components/workshop/cinematic-studio/CinematicMenu.vue'
import EditorSegmented from '@/components/workshop/app-editor/EditorSegmented.vue'
import EditorSourceTile from '@/components/workshop/app-editor/EditorSourceTile.vue'
import BackgroundRemovalAdjust from './BackgroundRemovalAdjust.vue'
import BackgroundRemovalAdvanced from './BackgroundRemovalAdvanced.vue'
import BackgroundRemovalPrompt from './BackgroundRemovalPrompt.vue'
import BackgroundRemovalSeed from './BackgroundRemovalSeed.vue'
import BackgroundRemovalSwatches from './BackgroundRemovalSwatches.vue'
import { modelName } from './model-name'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { image, phase, setup } = cutout
const modes = CUTOUT_MODES.map((id) => ({
  id,
  label: brc(`cutout.mode.${id}`, locale)
}))
const mode = computed({
  get: () => setup.value.mode,
  set: (next: CutoutMode) => cutout.update({ mode: next })
})
const CONTENT = {
  remove: BackgroundRemovalSwatches,
  replace: BackgroundRemovalPrompt,
  adjust: BackgroundRemovalAdjust
} as const

const formats = CUTOUT_FORMATS.map((id) => ({
  id,
  label: brc(`cutout.format.${id}`, locale),
  meta: brc(`cutout.format.${id}.detail`, locale)
}))
const format = computed({
  get: (): string => setup.value.format,
  set: (id: string) => {
    const picked = CUTOUT_FORMATS.find((option) => option === id)
    if (picked) cutout.update({ format: picked })
  }
})

const models = REPLACE_MODELS.map(({ id }) => ({
  id,
  label: modelName(id, locale)
}))
const model = computed({
  get: (): string => setup.value.replace.model,
  set: (id: string) => {
    const picked = REPLACE_MODELS.find((option) => option.id === id)
    if (picked) cutout.updateReplace({ model: picked.id })
  }
})
</script>

<template>
  <fieldset
    :disabled="phase.kind === 'running' || phase.kind === 'done'"
    class="flex min-w-0 flex-col gap-3 pt-2"
    data-testid="background-removal-panel"
  >
    <EditorSourceTile
      v-if="image"
      kind="image"
      :src="image.url"
      :name="image.name"
      :add-label="brc('cutout.empty.upload', locale)"
      :change-label="brc('cutout.image.change', locale)"
      input-test-id="background-removal-file"
      @file="cutout.useFile"
    />

    <EditorSegmented
      v-model="mode"
      :label="brc('cutout.mode', locale)"
      :options="modes"
      fill
    />
    <component :is="CONTENT[mode]" :cutout :locale />

    <BackgroundRemovalAdvanced :cutout :locale />

    <div :class="cn('grid gap-2', setup.mode === 'replace' && 'grid-cols-2')">
      <CinematicMenu
        v-model="format"
        :options="formats"
        :heading="brc('cutout.format', locale)"
        side="top"
        tooltip
        :trigger-class="FORMAT_TRIGGER_CLASS"
      >
        <FileImage class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
        <span class="flex-1 text-left">
          {{ brc(`cutout.format.${setup.format}`, locale) }}
        </span>
        <ChevronDown
          class="size-3.5 text-primary-warm-gray"
          aria-hidden="true"
        />
      </CinematicMenu>
      <template v-if="setup.mode === 'replace'">
        <CinematicMenu
          v-model="model"
          :options="models"
          :heading="brc('cutout.replace.model', locale)"
          side="top"
          tooltip
          :trigger-class="FORMAT_TRIGGER_CLASS"
        >
          <Cpu class="size-3.5 text-primary-warm-gray" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-left">
            {{ modelName(setup.replace.model, locale) }}
          </span>
          <ChevronDown
            class="size-3.5 text-primary-warm-gray"
            aria-hidden="true"
          />
        </CinematicMenu>
        <BackgroundRemovalSeed :cutout :locale class="col-span-2" />
      </template>
    </div>
  </fieldset>
</template>
