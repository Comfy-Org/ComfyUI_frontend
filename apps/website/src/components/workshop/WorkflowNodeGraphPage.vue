<script setup lang="ts">
import { ArrowUpRight, ChevronLeft } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { getRoutes } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphFacts from './WorkflowNodeGraphFacts.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)
const routes = getRoutes()

const cloudHref = computed(
  () =>
    `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(workflow.templateId)}`
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
      <div
        v-if="workflow.useCase"
        class="mb-3 flex flex-wrap items-center gap-3"
      >
        <a
          :href="workflow.useCase.href"
          :class="pillClass"
          data-testid="workflow-use-case"
          >{{ workflow.useCase.label }}</a
        >
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
      <div
        class="mt-6 flex flex-wrap items-center gap-2"
        data-testid="workflow-actions"
      >
        <Button
          as="a"
          :href="workflow.downloadUrl"
          download
          variant="outline"
          class="h-auto min-h-11 max-w-full whitespace-normal"
          :aria-label="t('workshop.workflow.download')"
          data-testid="node-graph-download"
          >{{ t('workshop.workflow.downloadShort') }}</Button
        >
        <Button
          as="a"
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          variant="ghost"
          class="h-auto min-h-11 max-w-full font-bold tracking-wider whitespace-normal uppercase"
          data-testid="node-graph-try-cloud"
          >{{ t('workshop.workflow.tryCloud') }}
          <template #append>
            <ArrowUpRight aria-hidden="true" />
          </template>
        </Button>
      </div>
    </header>

    <section data-testid="node-graph-details">
      <SectionHeading
        class="mb-8"
        :title="t('workshop.workflow.inside')"
        :subtitle="t('workshop.nodeGraph.graphHint')"
      />
      <div class="grid gap-10 lg:grid-cols-12">
        <div class="min-w-0 lg:col-span-8" data-testid="node-graph-graph">
          <WorkflowGraph
            :source="workflow.graph.source"
            :samples
            :fallback="workflow.graph.previewUrl"
            :full-href="workflow.graph.previewUrl"
          />
        </div>
        <div class="min-w-0 lg:col-span-4">
          <WorkflowNodeGraphFacts
            :workflow="workflow"
            :locale="locale"
            class="lg:sticky lg:top-24"
          />
        </div>
      </div>
    </section>
  </div>
</template>
