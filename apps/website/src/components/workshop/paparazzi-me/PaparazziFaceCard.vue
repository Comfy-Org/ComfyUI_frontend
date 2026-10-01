<script setup lang="ts">
import { ImageUp, X } from '@lucide/vue'
import { computed, useTemplateRef } from 'vue'

import type { PaparazziMe } from '../../../composables/usePaparazziMe'
import type { Locale } from '../../../i18n/translations'
import { pc } from '../../../lib/workshop/paparazzi-me/copy'
import { PAPARAZZI_EXAMPLE } from '../../../lib/workshop/paparazzi-me/mock-run'
import EditorIconButton from '../app-editor/EditorIconButton.vue'
import PaparazziFaceDrop from './PaparazziFaceDrop.vue'

const {
  paparazzi,
  disabled = false,
  locale = 'en'
} = defineProps<{
  paparazzi: PaparazziMe
  disabled?: boolean
  locale?: Locale
}>()

const { face } = paparazzi
const input = useTemplateRef<HTMLInputElement>('input')
const example = computed(() => face.value?.url === PAPARAZZI_EXAMPLE.url)
const focus = computed(() =>
  example.value
    ? `${PAPARAZZI_EXAMPLE.crop.cx * 100}% ${PAPARAZZI_EXAMPLE.crop.cy * 100}%`
    : '50% 35%'
)

function pick(files: FileList | null | undefined) {
  const file = files?.[0]
  if (file?.type.startsWith('image/')) void paparazzi.useFile(file)
}

function onChange(event: Event) {
  if (event.target instanceof HTMLInputElement) pick(event.target.files)
}
</script>

<template>
  <section
    :aria-label="pc('paparazzi.face', locale)"
    class="absolute top-3 right-3 z-10 w-36 -rotate-2 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink-light/95 p-1.5 shadow-xl shadow-black/50 backdrop-blur-md max-sm:top-2 max-sm:right-2 max-sm:w-22 max-sm:p-1"
    data-testid="paparazzi-face"
    @dragover.prevent
    @drop.prevent="!disabled && pick($event.dataTransfer?.files)"
  >
    <template v-if="face">
      <img
        :src="face.url"
        :alt="example ? pc('paparazzi.face.alt.example', locale) : face.name"
        :style="{ objectPosition: focus }"
        class="aspect-square w-full rounded-lg object-cover"
      />
      <div
        class="flex items-center gap-0.5 pt-1 pl-1 max-sm:justify-center max-sm:pl-0"
      >
        <span
          class="flex-1 truncate text-[11px] text-primary-warm-white max-sm:sr-only"
          >{{ pc('paparazzi.face', locale) }}</span
        >
        <EditorIconButton
          :icon="ImageUp"
          :label="pc('paparazzi.face.replace', locale)"
          :disabled
          @click="input?.click()"
        />
        <EditorIconButton
          :icon="X"
          :label="pc('paparazzi.face.remove', locale)"
          :disabled
          @click="paparazzi.removeFace"
        />
      </div>
    </template>
    <PaparazziFaceDrop
      v-else
      :disabled
      :locale
      @upload="input?.click()"
      @example="paparazzi.useExample"
    />
    <input
      ref="input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      data-testid="paparazzi-face-input"
      @change="onChange"
    />
  </section>
</template>
