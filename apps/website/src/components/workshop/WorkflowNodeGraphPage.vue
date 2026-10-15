<script setup lang="ts">
import { ChevronLeft, Workflow } from '@lucide/vue'
import { computed, ref } from 'vue'

import { getRoutes } from '@/config/routes'
import { useTablist } from '@/composables/useTablist'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import ExamplesTab from './ExamplesTab.vue'
import HighlightedCode from './HighlightedCode.vue'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphRunPanel from './WorkflowNodeGraphRunPanel.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const routes = getRoutes()

const sections = ['details', 'api'] as const
const section = ref<(typeof sections)[number]>('details')
const { onKeydown } = useTablist(() => sections, section)
const sectionLabels = {
  details: 'workshop.model.tabs.details',
  api: 'workshop.model.tabs.api'
} as const
const showsDetails = computed(
  () => !workflow.api || section.value === 'details'
)

const samples = computed(() =>
  workflow.examples
    .filter((example) => example.mediaKind !== 'video')
    .slice(0, 1)
    .map((example) => example.outputUrl)
)

const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
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
      v-if="workflow.api"
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
      v-show="showsDetails"
      id="node-graph-panel-details"
      :role="workflow.api ? 'tabpanel' : undefined"
      :aria-labelledby="workflow.api ? 'node-graph-tab-details' : undefined"
      data-testid="node-graph-details"
    >
      <div class="grid gap-10 lg:grid-cols-12">
        <section class="min-w-0 lg:col-span-8" data-testid="node-graph-graph">
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
            :active="showsDetails"
          />
        </section>
        <div class="min-w-0 lg:col-span-4">
          <WorkflowNodeGraphRunPanel
            :workflow="workflow"
            :locale="locale"
            class="lg:sticky lg:top-24"
          />
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
          :locale="locale"
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
      v-if="workflow.api"
      v-show="section === 'api'"
      id="node-graph-panel-api"
      role="tabpanel"
      aria-labelledby="node-graph-tab-api"
      data-testid="node-graph-api"
    >
      <SectionHeading
        class="mb-8"
        :title="t('workshop.nodeGraph.apiTitle')"
        :subtitle="t('workshop.nodeGraph.apiHint')"
      />
      <pre
        tabindex="0"
        class="max-h-168 max-w-4xl overflow-auto rounded-2xl border border-transparency-white-t8 bg-primary-comfy-ink p-6 text-sm/relaxed text-primary-warm-white"
      ><HighlightedCode :code="workflow.api.snippet" language="shell" /></pre>
    </section>
  </div>
</template>
