<script setup lang="ts">
import { ImageIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import ExamplesTab from './ExamplesTab.vue'
import WorkflowNodeGraphAbout from './WorkflowNodeGraphAbout.vue'

const {
  workflow,
  cloudHref,
  active,
  showAction = true,
  locale = 'en'
} = defineProps<{
  workflow: NodeGraphWorkflow
  cloudHref?: string
  active: boolean
  showAction?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const selectedExample = ref(0)
watch(
  () => workflow.examples.length,
  () => (selectedExample.value = 0)
)
const shown = computed(() => workflow.examples[selectedExample.value])
function openExample(id: string) {
  const index = workflow.examples.findIndex((example) => example.id === id)
  if (index !== -1) selectedExample.value = index
}
</script>

<template>
  <div data-testid="node-graph-overview">
    <div class="grid gap-8 lg:grid-cols-12">
      <WorkflowNodeGraphAbout
        :workflow="workflow"
        :cloud-href="cloudHref"
        :active="active"
        :show-action="showAction"
        :locale="locale"
        class="lg:col-span-5"
      />

      <section
        class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 max-lg:order-first lg:sticky lg:top-24 lg:col-span-7 lg:self-start"
        data-testid="node-graph-output"
      >
        <header
          class="flex items-center justify-between border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
        >
          <span>{{ t('workshop.output.title') }}</span>
          <span
            v-if="workflow.examples.length > 1"
            class="font-normal tracking-normal text-primary-warm-gray normal-case tabular-nums"
          >
            {{
              t('workshop.nodeGraph.sampleOf', {
                n: selectedExample + 1,
                total: workflow.examples.length
              })
            }}
          </span>
        </header>
        <figure v-if="shown" class="relative bg-primary-comfy-ink-light">
          <span
            class="absolute top-3 right-3 z-20 inline-flex h-6 items-center rounded-lg bg-black/40 px-2 text-2xs font-bold tracking-wider text-white uppercase backdrop-blur-md"
          >
            {{ t('workshop.output.example') }}
          </span>
          <video
            v-if="shown.mediaKind === 'video'"
            :key="shown.id"
            :src="shown.outputUrl"
            class="max-h-[70vh] w-full object-contain"
            autoplay
            muted
            loop
            playsinline
          />
          <img
            v-else
            :key="shown.id"
            :src="shown.outputUrl"
            :alt="shown.title"
            class="max-h-[70vh] w-full object-contain"
          />
          <figcaption
            class="border-t border-transparency-white-t8 bg-page px-5 py-3 text-sm text-primary-comfy-canvas"
          >
            {{ shown.title }}
          </figcaption>
        </figure>
        <div
          v-else
          class="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
          data-testid="node-graph-no-examples"
        >
          <span
            class="grid size-12 place-items-center rounded-2xl border border-dashed border-transparency-white-t20 text-primary-warm-gray"
            aria-hidden="true"
          >
            <ImageIcon class="size-5" />
          </span>
          <p class="text-sm text-primary-warm-gray">
            {{ t('workshop.nodeGraph.noExamples') }}
          </p>
        </div>
      </section>
    </div>

    <section v-if="workflow.examples.length > 1" class="mt-14">
      <ExamplesTab
        :examples="workflow.examples"
        :gallery-label="workflow.name"
        :active-id="shown?.id"
        :locale="locale"
        @open="openExample($event.id)"
      />
    </section>
  </div>
</template>
