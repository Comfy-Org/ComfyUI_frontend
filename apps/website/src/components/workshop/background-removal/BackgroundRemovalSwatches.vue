<script setup lang="ts">
import { translationsFor } from '@/i18n/translations'
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { Locale } from '@/i18n/translations'
import {
  BACKGROUND_SWATCHES,
  backgroundSwatch,
  swatchBackground
} from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import EditorChecker from '@/components/workshop/app-editor/EditorChecker.vue'
import EditorColorPicker from '@/components/workshop/app-editor/EditorColorPicker.vue'
import EditorPopover from '@/components/workshop/app-editor/EditorPopover.vue'

const { cutout, locale = 'en' } = defineProps<{
  cutout: BackgroundRemoval
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const { setup } = cutout
const picking = ref(false)
const lastCustom = ref('#7a9cc6')

const selected = computed(() => backgroundSwatch(setup.value.background)?.id)
const customColor = computed(() => {
  const { background } = setup.value
  return background.kind === 'color' && !selected.value
    ? background.color
    : lastCustom.value
})

function pickCustom(color: string) {
  lastCustom.value = color
  cutout.update({ background: { kind: 'color', color } }, 'custom-color')
}

function openPicker() {
  if (selected.value) pickCustom(customColor.value)
  picking.value = !picking.value
}

const swatchClass = (checked: boolean) =>
  cn(
    'relative aspect-square w-full overflow-hidden rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-comfy-yellow/70 disabled:opacity-40',
    checked
      ? 'ring-2 ring-primary-warm-white ring-offset-2 ring-offset-primary-comfy-ink-light'
      : 'ring-1 ring-transparency-white-t8 ring-inset hover:ring-transparency-white-t20'
  )
</script>

<template>
  <div class="flex flex-col gap-3 px-1">
    <div
      role="radiogroup"
      :aria-label="brc('cutout.swatches', locale)"
      class="grid grid-cols-6 gap-2"
    >
      <button
        v-for="swatch in BACKGROUND_SWATCHES"
        :key="swatch.id"
        type="button"
        role="radio"
        :aria-checked="selected === swatch.id"
        :aria-label="brc(`cutout.swatch.${swatch.id}`, locale)"
        :title="brc(`cutout.swatch.${swatch.id}`, locale)"
        :class="swatchClass(selected === swatch.id)"
        :style="{ backgroundColor: swatch.color ?? undefined }"
        @click="cutout.update({ background: swatchBackground(swatch.color) })"
      >
        <EditorChecker v-if="!swatch.color" />
      </button>
      <button
        type="button"
        role="radio"
        :aria-checked="!selected"
        aria-haspopup="dialog"
        :aria-expanded="picking"
        :aria-label="brc('cutout.swatch.custom', locale)"
        :title="brc('cutout.swatch.custom', locale)"
        :class="swatchClass(!selected)"
        class="grid place-items-center bg-[conic-gradient(#f87171,#facc15,#4ade80,#22d3ee,#818cf8,#e879f9,#f87171)]"
        @click="openPicker"
      >
        <span
          v-if="!selected"
          class="size-3 rounded-full ring-2 ring-primary-warm-white"
          :style="{ backgroundColor: customColor }"
          aria-hidden="true"
        />
      </button>
    </div>
    <EditorPopover
      v-if="picking"
      :title="brc('cutout.swatch.custom', locale)"
      :close-label="t('cinematic.picker.close')"
      @close="picking = false"
    >
      <EditorColorPicker
        :model-value="customColor"
        :labels="{
          shade: t('cinematic.colors.shade'),
          hue: t('cinematic.colors.hue'),
          hex: t('cinematic.colors.hex')
        }"
        @update:model-value="pickCustom"
      />
    </EditorPopover>
  </div>
</template>
