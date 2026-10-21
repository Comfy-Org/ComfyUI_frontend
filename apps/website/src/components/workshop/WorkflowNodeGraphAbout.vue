<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type {
  NodeGraphInput,
  NodeGraphInputMedia
} from '@/lib/hub/node-graph-inputs'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import WorkflowNodeGraphAboutFooter from './WorkflowNodeGraphAboutFooter.vue'

const {
  workflow,
  inputs,
  active,
  locale = 'en'
} = defineProps<{
  workflow: NodeGraphWorkflow
  /** Undefined while the graph is still being read. */
  inputs?: readonly NodeGraphInput[]
  active: boolean
  locale?: Locale
}>()
const emit = defineEmits<{ download: []; tryCloud: [] }>()
const { t } = translationsFor(locale)

const mediaLabels = {
  image: 'workshop.output.kindImage',
  video: 'workshop.output.kindVideo',
  audio: 'workshop.output.kindAudio'
} as const satisfies Record<NodeGraphInputMedia, string>

const MEDIA_ORDER: readonly NodeGraphInputMedia[] = ['image', 'video', 'audio']
const orderedInputs = computed(() =>
  inputs?.toSorted(
    (a, b) => MEDIA_ORDER.indexOf(a.media) - MEDIA_ORDER.indexOf(b.media)
  )
)

const expanded = ref(false)
const lead = computed(() => workflow.description[0])
const more = computed(() => workflow.description.slice(1))
</script>

<template>
  <section
    class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    aria-labelledby="workflow-about-heading"
    data-testid="node-graph-about"
  >
    <h2
      id="workflow-about-heading"
      class="border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.nodeGraph.about') }}
    </h2>
    <div class="space-y-6 p-5">
      <div class="space-y-3 text-sm/relaxed text-primary-comfy-canvas">
        <p>{{ lead }}</p>
        <template v-if="expanded">
          <p v-for="paragraph in more" :key="paragraph">{{ paragraph }}</p>
        </template>
        <button
          v-if="more.length"
          type="button"
          class="cursor-pointer text-sm text-primary-warm-gray underline underline-offset-4 hover:text-primary-comfy-yellow"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{
            t(
              expanded
                ? 'workshop.nodeGraph.readLess'
                : 'workshop.nodeGraph.readMore'
            )
          }}
        </button>
      </div>

      <div
        v-if="inputs === undefined || inputs.length"
        data-testid="node-graph-inputs"
        :aria-busy="inputs === undefined"
      >
        <h3
          class="text-2xs font-bold tracking-wider text-primary-warm-gray uppercase"
        >
          {{ t('workshop.nodeGraph.provide') }}
        </h3>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li
            v-if="inputs === undefined"
            class="inline-flex h-8 w-36 rounded-lg bg-transparency-white-t8 motion-safe:animate-pulse"
            data-testid="node-graph-inputs-loading"
          >
            <span class="sr-only">{{ t('workshop.nodeGraph.reading') }}</span>
          </li>
          <li
            v-for="(input, index) in orderedInputs ?? []"
            :key="index"
            class="inline-flex h-8 items-center rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-primary-comfy-canvas"
          >
            {{ input.title ?? t(mediaLabels[input.media]) }}
          </li>
        </ul>
      </div>
    </div>

    <WorkflowNodeGraphAboutFooter
      :cloud-href="workflow.cloudHref"
      :download-url="workflow.downloadUrl"
      :active="active"
      :locale="locale"
      @download="emit('download')"
      @try-cloud="emit('tryCloud')"
    />
  </section>
</template>
