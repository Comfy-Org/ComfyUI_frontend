<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed } from 'vue'

import type { BackgroundRemoval } from '../../../composables/useBackgroundRemoval'
import type { EditorImage } from '../../../composables/useEditorImage'
import type { Locale } from '../../../i18n/translations'
import { brc } from '../../../lib/workshop/background-removal/copy'
import { CUTOUT_EXAMPLE } from '../../../lib/workshop/background-removal/mask'
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

const { phase, touched } = cutout
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
</script>

<template>
  <EditorFrame :width="image.width" :height="image.height">
    <div
      class="relative size-full select-none"
      data-testid="background-removal-stage"
    >
      <img
        :src="image.url"
        :alt="
          image.url === CUTOUT_EXAMPLE.url
            ? brc('cutout.alt.example', locale)
            : image.name
        "
        draggable="false"
        class="size-full rounded-sm object-cover"
      />
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="brc('cutout.hint', locale)"
      />
      <EditorBusy
        v-if="phase.kind === 'running'"
        :title="brc('cutout.busy.title', locale)"
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
