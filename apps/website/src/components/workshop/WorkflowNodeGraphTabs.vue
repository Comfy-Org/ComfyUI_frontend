<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useNodeGraphNeeds } from '@/composables/useNodeGraphNeeds'
import { useTablist } from '@/composables/useTablist'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'
import { sampleMedia } from '@/lib/hub/node-graph-workflow'

import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphCustomNodes from './WorkflowNodeGraphCustomNodes.vue'
import WorkflowNodeGraphOverview from './WorkflowNodeGraphOverview.vue'
import WorkflowNodeGraphVersions from './WorkflowNodeGraphVersions.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const emit = defineEmits<{
  download: [placement: 'footer' | 'versions']
  tryCloud: []
  tabSwitched: [tab: Section]
}>()
const { t } = translationsFor(locale)

const selectedFile = ref<string>()
watch(
  () => workflow.graphSource,
  () => (selectedFile.value = undefined)
)
const graphSource = computed(
  () =>
    workflow.files?.find(({ href }) => href === selectedFile.value)?.href ??
    workflow.graphSource
)
const needs = useNodeGraphNeeds(graphSource)
const samples = computed(() =>
  workflow.examples
    .filter((example) => sampleMedia(example) === 'image')
    .slice(0, 1)
    .map((example) => example.outputUrl)
)

const sections = ['overview', 'workflow', 'api'] as const
type Section = (typeof sections)[number]
const section = ref<Section>('overview')
watch(section, (tab) => emit('tabSwitched', tab))
const { onKeydown } = useTablist(() => sections, section)
const sectionLabels = {
  overview: 'workshop.nodeGraph.tabOverview',
  workflow: 'workshop.model.tabs.details',
  api: 'workshop.nodeGraph.tabApi'
} as const
</script>

<template>
  <div data-testid="node-graph-workflow">
    <div
      role="tablist"
      :aria-label="t('workshop.workflow.sections')"
      class="mb-6 flex gap-7 border-b border-transparency-white-t8"
      @keydown="onKeydown"
    >
      <button
        v-for="item in sections"
        :id="`workflow-tab-${item}`"
        :key="item"
        type="button"
        role="tab"
        :aria-selected="section === item"
        :aria-controls="`workflow-panel-${item}`"
        :tabindex="section === item ? 0 : -1"
        class="min-h-12 cursor-pointer border-b-2 border-transparent px-1 text-sm font-bold tracking-wider text-primary-warm-gray uppercase transition-colors hover:text-primary-warm-white aria-selected:border-primary-comfy-yellow aria-selected:text-primary-warm-white"
        @click="section = item"
      >
        {{ t(sectionLabels[item]) }}
      </button>
    </div>

    <WorkflowNodeGraphOverview
      v-show="section === 'overview'"
      id="workflow-panel-overview"
      role="tabpanel"
      aria-labelledby="workflow-tab-overview"
      :workflow="workflow"
      :needs="needs"
      :active="section === 'overview'"
      :locale="locale"
      @download="emit('download', 'footer')"
      @try-cloud="emit('tryCloud')"
    />

    <section
      v-show="section === 'workflow'"
      id="workflow-panel-workflow"
      role="tabpanel"
      aria-labelledby="workflow-tab-workflow"
      data-testid="node-graph-details"
    >
      <SectionHeading
        class="mb-8"
        :title="t('workshop.workflow.inside')"
        :subtitle="t('workshop.nodeGraph.graphHint')"
      />
      <div class="grid gap-10 lg:grid-cols-12">
        <div class="min-w-0 lg:col-span-8" data-testid="node-graph-graph">
          <WorkflowGraph
            v-if="graphSource"
            :key="graphSource"
            :source="graphSource"
            :samples
            :fallback="workflow.graphFallback"
            :full-href="workflow.graphFallback ?? graphSource"
            :active="section === 'workflow'"
          />
          <img
            v-else-if="workflow.graphFallback"
            :src="workflow.graphFallback"
            :alt="t('workshop.workflow.graph')"
            loading="lazy"
            class="max-h-160 w-full rounded-2xl border border-transparency-white-t8 object-contain"
          />
        </div>
        <div class="min-w-0 lg:col-span-4">
          <div class="flex flex-col gap-4 lg:sticky lg:top-24">
            <WorkflowNodeGraphVersions
              v-if="workflow.files && workflow.files.length > 1"
              :files="workflow.files"
              :selected="graphSource"
              :download-name="workflow.downloadName"
              :locale="locale"
              @select="selectedFile = $event"
              @download="emit('download', 'versions')"
            />
            <slot name="facts" />
            <WorkflowNodeGraphCustomNodes :needs="needs" :locale="locale" />
          </div>
        </div>
      </div>
    </section>

    <div
      v-show="section === 'api'"
      id="workflow-panel-api"
      role="tabpanel"
      aria-labelledby="workflow-tab-api"
    >
      <slot name="api" />
    </div>
  </div>
</template>
