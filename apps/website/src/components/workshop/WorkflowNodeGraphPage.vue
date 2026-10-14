<script setup lang="ts">
import {
  ArrowUpRight,
  Box,
  ChevronLeft,
  Download,
  Puzzle,
  Workflow
} from '@lucide/vue'
import { computed, ref } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { getRoutes } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { PlaygroundExample } from '@/config/workshop-playground'
import type { RunState } from '@/config/workshop-run'
import { useTablist } from '@/composables/useTablist'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import ExamplesTab from './ExamplesTab.vue'
import PlaygroundOutput from './PlaygroundOutput.vue'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const routes = getRoutes()

// The same two tabs a runnable workflow keeps once its Playground is gone:
// what it makes, and the graph that makes it.
const sections = ['overview', 'workflow'] as const
const section = ref<(typeof sections)[number]>('overview')
const { onKeydown } = useTablist(() => sections, section)
const sectionLabels = {
  overview: 'workshop.nodeGraph.tabs.overview',
  workflow: 'workshop.nodeGraph.tabs.workflow'
} as const

const cloudHref = computed(
  () =>
    `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(workflow.templateId)}`
)

const selected = ref(0)
const activeExample = computed(() => workflow.examples[selected.value])
const outputState = computed((): RunState => {
  const example = activeExample.value
  if (!example) return { status: 'idle' }
  return {
    status: 'example',
    output: {
      kind: example.mediaKind ?? 'image',
      url: example.outputUrl,
      fileName: example.title
    }
  }
})
const samples = computed(() =>
  workflow.examples
    .filter((example) => example.mediaKind !== 'video')
    .slice(0, 1)
    .map((example) => example.outputUrl)
)

function openExample(example: PlaygroundExample) {
  const index = workflow.examples.findIndex((item) => item.id === example.id)
  if (index !== -1) selected.value = index
}

const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
const panelClass =
  'overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4'
const panelHeadingClass =
  'border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const factHeadingClass =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <div
    class="mx-auto max-w-10xl px-6 pt-5 pb-20 lg:px-8"
    data-testid="node-graph-workflow"
  >
    <a
      :href="routes.hubWorkflows"
      class="mb-7 inline-flex min-h-11 items-center gap-1 text-sm text-primary-warm-gray hover:text-primary-comfy-yellow"
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
      {{ t('workshop.catalogue.backToWorkflows') }}
    </a>
    <header class="mb-9" data-testid="workflow-hero">
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <a
          v-if="workflow.useCase"
          :href="workflow.useCase.href"
          :class="pillClass"
          data-testid="workflow-use-case"
          >{{ workflow.useCase.label }}</a
        >
        <span
          class="inline-flex h-7 items-center gap-1.5 rounded-full bg-transparency-white-t8 px-3 text-xs leading-none text-primary-warm-white"
          data-testid="node-graph-badge"
        >
          <Workflow class="size-3.5" aria-hidden="true" />
          {{ t('workshop.nodeGraph.badge') }}
        </span>
      </div>
      <h1
        class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
      >
        {{ workflow.name }}
      </h1>
      <p
        class="mt-4 text-lg text-primary-warm-gray lg:truncate"
        :title="workflow.summary"
      >
        {{ workflow.summary }}
      </p>
    </header>

    <div
      role="tablist"
      :aria-label="t('workshop.workflow.sections')"
      class="mb-6 flex gap-7 border-b border-transparency-white-t8"
      @keydown="onKeydown"
    >
      <button
        v-for="item in sections"
        :id="`node-graph-tab-${item}`"
        :key="item"
        type="button"
        role="tab"
        :aria-selected="section === item"
        :aria-controls="`node-graph-panel-${item}`"
        :tabindex="section === item ? 0 : -1"
        class="min-h-12 cursor-pointer border-b-2 border-transparent px-1 text-sm font-bold tracking-wider text-primary-warm-gray uppercase transition-colors hover:text-primary-warm-white aria-selected:border-primary-comfy-yellow aria-selected:text-primary-warm-white"
        @click="section = item"
      >
        {{ t(sectionLabels[item]) }}
      </button>
    </div>

    <div
      v-show="section === 'overview'"
      id="node-graph-panel-overview"
      role="tabpanel"
      aria-labelledby="node-graph-tab-overview"
    >
      <div class="grid gap-8 lg:grid-cols-12">
        <!-- Where a runnable workflow keeps its inputs and Run, this one says
          what running it takes and offers the two ways to do it. -->
        <section
          :class="[panelClass, 'flex min-w-0 flex-col lg:col-span-5']"
          aria-labelledby="node-graph-run-heading"
          data-testid="node-graph-run-panel"
        >
          <h2 id="node-graph-run-heading" :class="panelHeadingClass">
            {{ t('workshop.nodeGraph.runTitle') }}
          </h2>
          <div class="flex flex-col gap-6 p-5">
            <p class="text-sm/relaxed text-primary-warm-gray">
              {{ t('workshop.nodeGraph.runBody') }}
            </p>
            <section v-if="workflow.inputs.length">
              <h3 :class="factHeadingClass">
                {{ t('workshop.workflow.inputs') }}
              </h3>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li
                  v-for="name in workflow.inputs"
                  :key="name"
                  class="inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas"
                >
                  {{ name }}
                </li>
              </ul>
            </section>
            <section v-if="workflow.models.length">
              <h3 :class="factHeadingClass">
                {{ t('workshop.nodeGraph.models') }}
              </h3>
              <ul class="mt-2 flex flex-col gap-1">
                <li
                  v-for="name in workflow.models"
                  :key="name"
                  class="flex items-center gap-2.5 py-1"
                >
                  <Box
                    class="size-4 shrink-0 text-primary-warm-gray"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 truncate text-primary-comfy-canvas">
                    {{ name }}
                  </span>
                </li>
              </ul>
            </section>
            <section v-if="workflow.customNodes.length">
              <h3 :class="factHeadingClass">
                {{ t('workshop.workflow.customNodes') }}
              </h3>
              <ul class="mt-2 flex flex-col gap-1">
                <li
                  v-for="name in workflow.customNodes"
                  :key="name"
                  class="flex items-center gap-2.5 py-1"
                >
                  <Puzzle
                    class="size-4 shrink-0 text-primary-warm-gray"
                    aria-hidden="true"
                  />
                  <span class="min-w-0 truncate text-primary-comfy-canvas">
                    {{ name }}
                  </span>
                </li>
              </ul>
            </section>
          </div>
          <div
            class="mt-auto space-y-2 border-t border-transparency-white-t8 p-3"
            data-testid="workflow-actions"
          >
            <Button
              as="a"
              size="lg"
              class="w-full"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              data-testid="node-graph-try-cloud"
              >{{ t('workshop.nodeGraph.tryCloud') }}
              <template #append>
                <ArrowUpRight aria-hidden="true" />
              </template>
            </Button>
            <Button
              as="a"
              size="lg"
              variant="outline"
              class="w-full"
              :href="workflow.downloadUrl"
              download
              :aria-label="t('workshop.workflow.download')"
              data-testid="node-graph-download"
            >
              <template #prepend>
                <Download aria-hidden="true" />
              </template>
              {{ t('workshop.nodeGraph.download') }}
            </Button>
            <p class="px-1 text-xs/relaxed text-primary-warm-gray">
              {{ t('workshop.nodeGraph.downloadHint') }}
            </p>
          </div>
        </section>
        <div class="min-w-0 lg:sticky lg:top-24 lg:col-span-7 lg:self-start">
          <PlaygroundOutput :state="outputState" :now="0" :locale="locale" />
        </div>
      </div>

      <section
        v-if="workflow.examples.length"
        class="mt-14"
        data-testid="examples-section"
      >
        <ExamplesTab
          :examples="workflow.examples"
          :gallery-label="workflow.name"
          :active-id="activeExample?.id"
          :locale="locale"
          @open="openExample"
        />
      </section>

      <section
        class="mt-14 max-w-3xl"
        aria-labelledby="node-graph-about-heading"
        data-testid="node-graph-about"
      >
        <h2
          id="node-graph-about-heading"
          class="text-sm font-bold text-primary-warm-white"
        >
          {{ t('workshop.nodeGraph.about') }}
        </h2>
        <p
          v-for="paragraph in workflow.description"
          :key="paragraph"
          class="mt-4 text-base/relaxed text-primary-warm-gray"
        >
          {{ paragraph }}
        </p>
      </section>
    </div>

    <section
      v-show="section === 'workflow'"
      id="node-graph-panel-workflow"
      role="tabpanel"
      aria-labelledby="node-graph-tab-workflow"
    >
      <SectionHeading
        class="mb-8"
        :title="t('workshop.workflow.inside')"
        :subtitle="t('workshop.nodeGraph.graphHint')"
      />
      <WorkflowGraph
        :source="workflow.graph.source"
        :samples
        :fallback="workflow.graph.previewUrl"
        :full-href="workflow.graph.previewUrl"
        :active="section === 'workflow'"
      />
    </section>
  </div>
</template>
