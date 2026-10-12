<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { BackgroundRemoval } from '@/composables/useBackgroundRemoval'
import type { EditorImage } from '@/composables/useEditorImage'
import type { Locale } from '@/i18n/translations'
import {
  adjustFilter,
  blurBleed
} from '@/lib/workshop/background-removal/contract'
import { brc } from '@/lib/workshop/background-removal/copy'
import {
  CUTOUT_EXAMPLE,
  subjectMaskImage
} from '@/lib/workshop/background-removal/mask'
import { elapsedLabel } from '@/lib/workshop/elapsed'
import EditorBusy from '@/components/workshop/app-editor/EditorBusy.vue'
import EditorDropZone from '@/components/workshop/app-editor/EditorDropZone.vue'
import EditorFrame from '@/components/workshop/app-editor/EditorFrame.vue'
import EditorHint from '@/components/workshop/app-editor/EditorHint.vue'
import BackgroundRemovalSubject from './BackgroundRemovalSubject.vue'
import { sectionMeta } from './sections'

const {
  image,
  cutout,
  locale = 'en'
} = defineProps<{
  image: EditorImage
  cutout: BackgroundRemoval
  locale?: Locale
}>()

const { phase, touched, setup } = cutout
const now = useNow({ interval: 1000 })
const detail = computed(() =>
  phase.value.kind === 'running'
    ? brc('cutout.busy.detail', locale, {
        time: elapsedLabel(now.value.getTime() - phase.value.startedAt),
        background: sectionMeta('background', cutout, locale),
        format: sectionMeta('format', cutout, locale)
      })
    : ''
)
const filters = computed(() => {
  const { mode, adjust } = setup.value
  const filter =
    mode === 'adjust'
      ? adjustFilter(adjust, (share) => `${share * 100}cqw`)
      : 'none'
  const bleed = mode === 'adjust' ? blurBleed(adjust) : 1
  return {
    scale: bleed === 1 ? undefined : `scale(${bleed})`,
    background: adjust.target === 'background' ? filter : 'none',
    foreground: adjust.target === 'foreground' ? filter : 'none'
  }
})
</script>

<template>
  <EditorFrame :width="image.width" :height="image.height">
    <EditorDropZone
      class="relative size-full overflow-hidden rounded-sm select-none"
      style="container-type: inline-size"
      data-testid="background-removal-stage"
      @file="cutout.useFile"
    >
      <img
        :src="image.url"
        :alt="
          image.url === CUTOUT_EXAMPLE.url
            ? brc('cutout.alt.example', locale)
            : image.name
        "
        draggable="false"
        class="size-full object-cover"
        :style="{ filter: filters.background, transform: filters.scale }"
      />
      <img
        v-if="setup.mode === 'adjust'"
        :src="image.url"
        alt=""
        draggable="false"
        class="pointer-events-none absolute inset-0 size-full object-cover"
        :style="{
          filter: filters.foreground,
          maskImage: subjectMaskImage(image.url),
          maskSize: '100% 100%'
        }"
        data-testid="background-removal-foreground"
      />
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="brc('cutout.hint', locale)"
      />
      <EditorBusy
        v-if="phase.kind === 'running'"
        :title="brc(`cutout.busy.${setup.mode}`, locale)"
        :detail
        :cancel-label="brc('cutout.cancel', locale)"
        @cancel="cutout.cancel"
      >
        <span class="absolute inset-0 motion-safe:animate-pulse">
          <BackgroundRemovalSubject :url="image.url" />
        </span>
      </EditorBusy>
    </EditorDropZone>
  </EditorFrame>
</template>
