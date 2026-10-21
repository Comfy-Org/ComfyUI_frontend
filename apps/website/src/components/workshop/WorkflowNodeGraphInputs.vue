<script setup lang="ts">
import { computed } from 'vue'

import type { NodeGraphNeeds } from '@/composables/useNodeGraphNeeds'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphInputMedia } from '@/lib/hub/node-graph-inputs'

const { needs, locale = 'en' } = defineProps<{
  needs: NodeGraphNeeds
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const mediaLabels = {
  image: 'workshop.output.kindImage',
  video: 'workshop.output.kindVideo',
  audio: 'workshop.output.kindAudio'
} as const satisfies Record<NodeGraphInputMedia, string>

const MEDIA_ORDER: readonly NodeGraphInputMedia[] = ['image', 'video', 'audio']
const orderedInputs = computed(() =>
  (needs.status === 'read' ? needs.inputs : []).toSorted(
    (a, b) => MEDIA_ORDER.indexOf(a.media) - MEDIA_ORDER.indexOf(b.media)
  )
)
</script>

<template>
  <div
    v-if="needs.status !== 'read' || needs.inputs.length"
    data-testid="node-graph-inputs"
    :aria-busy="needs.status === 'loading'"
  >
    <h3
      class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
    >
      {{ t('workshop.nodeGraph.provide') }}
    </h3>
    <ul class="mt-3 flex flex-wrap gap-2">
      <li
        v-if="needs.status === 'loading'"
        class="inline-flex h-8 w-36 rounded-lg bg-transparency-white-t8 motion-safe:animate-pulse"
        data-testid="node-graph-inputs-loading"
      >
        <span class="sr-only">{{ t('workshop.nodeGraph.reading') }}</span>
      </li>
      <li
        v-if="needs.status === 'failed'"
        class="text-sm text-primary-warm-gray"
        data-testid="node-graph-inputs-failed"
      >
        {{ t('workshop.nodeGraph.readFailed') }}
      </li>
      <li
        v-for="(input, index) in orderedInputs"
        :key="index"
        class="inline-flex h-8 items-center rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-primary-comfy-canvas"
      >
        {{ input.title ?? t(mediaLabels[input.media]) }}
      </li>
    </ul>
  </div>
</template>
