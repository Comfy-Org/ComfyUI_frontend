<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import type { VirtualTryOn } from '../../../composables/useVirtualTryOn'
import type { Locale } from '../../../i18n/translations'
import { elapsedLabel } from '../../../lib/workshop/elapsed'
import { vc } from '../../../lib/workshop/virtual-try-on/copy'
import EditorBusy from '../app-editor/EditorBusy.vue'
import EditorFrame from '../app-editor/EditorFrame.vue'
import EditorHint from '../app-editor/EditorHint.vue'
import VirtualTryOnGarmentCard from './VirtualTryOnGarmentCard.vue'
import VirtualTryOnOutline from './VirtualTryOnOutline.vue'
import { personAlt } from './person-alt'

const { tryOn, locale = 'en' } = defineProps<{
  tryOn: VirtualTryOn
  locale?: Locale
}>()

const { person, setup, garment, phase, guide } = tryOn
const touched = ref(false)
watch([setup, person], () => (touched.value = true))

const running = computed(() => phase.value.kind === 'running')
const now = useNow({ interval: 1000 })
const detail = computed(() =>
  phase.value.kind === 'running'
    ? vc('tryOn.busy.detail', locale, {
        time: elapsedLabel(now.value.getTime() - phase.value.startedAt),
        garment: garment.value?.name ?? '',
        fit: vc(`tryOn.fit.${setup.value.fit}`, locale)
      })
    : ''
)
</script>

<template>
  <div class="size-full max-w-5xl">
    <EditorFrame :width="person.width" :height="person.height">
      <img
        :src="person.url"
        :alt="personAlt(person, locale)"
        class="size-full rounded-sm object-cover"
        data-testid="try-on-person"
      />
      <VirtualTryOnOutline
        v-if="guide && garment && !running"
        :person="person.url"
        :fit="setup.fit"
      />
      <EditorHint
        v-if="!touched && phase.kind === 'editing'"
        :text="vc('tryOn.hint', locale)"
      />
      <EditorBusy
        v-if="running"
        :title="vc('tryOn.busy.title', locale)"
        :detail
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
