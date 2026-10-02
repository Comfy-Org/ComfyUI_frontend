<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { EditorImage } from '../../../composables/useEditorImage'
import type { Locale } from '../../../i18n/translations'
import { adjustFilter } from '../../../lib/workshop/background-removal/contract'
import { brc } from '../../../lib/workshop/background-removal/copy'
import {
  CUTOUT_EXAMPLE,
  subjectMaskImage
} from '../../../lib/workshop/background-removal/mask'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'
import EditorHint from '../app-editor/EditorHint.vue'
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
  return {
    background: adjust.target === 'background' ? filter : 'none',
    foreground: adjust.target === 'foreground' ? filter : 'none'
  }
})

function drop(event: DragEvent) {
  const [file] = event.dataTransfer?.files ?? []
  if (file?.type.startsWith('image/')) void cutout.useFile(file)
}
</script>

<template>
  <EditorFrame :width="image.width" :height="image.height">
    <div
      class="relative size-full overflow-hidden rounded-sm select-none"
      style="container-type: inline-size"
      data-testid="background-removal-stage"
      @dragover.prevent
      @drop.prevent="drop"
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
        :style="{ filter: filters.background }"
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
    </div>
  </EditorFrame>
</template>
