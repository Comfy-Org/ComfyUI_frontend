<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import { mockProgress } from '../../../lib/workshop/virtual-try-on/mock-run'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import VirtualTryOnDropZone from './VirtualTryOnDropZone.vue'
import VirtualTryOnGarmentCard from './VirtualTryOnGarmentCard.vue'
import { personAlt } from './person-alt'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person, setup, garment, phase } = tryOn
const touched = ref(false)
watch([setup, person], () => (touched.value = true))

const running = computed(() => phase.value.kind === 'running')
const now = useNow({ interval: 200 })
const busy = computed(() => {
  if (phase.value.kind !== 'running') return undefined
  const elapsed = now.value.getTime() - phase.value.startedAt
  const progress = mockProgress(elapsed)
  return {
    title:
      progress.stage === 'queued'
        ? vc('tryOn.busy.queued', locale)
        : vc('tryOn.busy.running', locale, { percent: progress.percent }),
    detail: vc('tryOn.busy.detail', locale, {
      time: elapsedLabel(elapsed),
      garment: garment.value?.name ?? '',
      fit: vc(`tryOn.fit.${setup.value.fit}`, locale)
    })
  }
})
</script>

<template>
  <div class="size-full max-w-5xl">
    <EditorFrame :width="person.width" :height="person.height">
      <VirtualTryOnDropZone
        :disabled="running"
        class="absolute inset-0 rounded-sm"
        data-testid="try-on-person-drop"
        @file="tryOn.usePersonFile"
      >
        <img
          :src="person.url"
          :alt="personAlt(person, locale)"
          class="size-full rounded-sm object-cover"
          data-testid="try-on-person"
        />
      </VirtualTryOnDropZone>
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="vc('tryOn.hint', locale)"
      />
      <EditorBusy
        v-if="busy"
        :title="busy.title"
        :detail="busy.detail"
        :cancel-label="vc('tryOn.cancel', locale)"
        @cancel="tryOn.cancel"
      />
      <span
        v-if="running"
        class="pointer-events-none absolute inset-0 animate-editor-shimmer rounded-sm bg-linear-to-r from-transparent from-40% via-primary-warm-white/20 via-50% to-transparent to-60% bg-size-[300%_100%]"
        aria-hidden="true"
      />
      <VirtualTryOnGarmentCard :try-on :locale />
    </EditorFrame>
  </div>
</template>
