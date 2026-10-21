<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { useNodeGraphNeeds } from '@/composables/useNodeGraphNeeds'
import { useTablist } from '@/composables/useTablist'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'
import { sampleMedia } from '@/lib/hub/node-graph-workflow'

import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphFacts from './WorkflowNodeGraphFacts.vue'
import WorkflowNodeGraphOverview from './WorkflowNodeGraphOverview.vue'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const emit = defineEmits<{ download: []; tryCloud: [] }>()
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
function selectFile(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    selectedFile.value = event.target.value
}
const needs = useNodeGraphNeeds(graphSource)
const samples = computed(() =>
  workflow.examples
    .filter((example) => sampleMedia(example) === 'image')
    .slice(0, 1)
    .map((example) => example.outputUrl)
)

const sections = ['overview', 'workflow', 'api'] as const
const section = ref<(typeof sections)[number]>('overview')
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
      @download="emit('download')"
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
            <div
              v-if="workflow.files && workflow.files.length > 1"
              class="flex flex-col gap-3"
              data-testid="workflow-versions"
            >
              <label class="grid gap-2 text-sm text-primary-warm-gray">
                {{ t('cccWorkflow.version') }}
                <select
                  :value="graphSource"
                  class="min-h-11 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-primary-comfy-canvas"
                  @change="selectFile"
                >
                  <option
                    v-for="file in workflow.files"
                    :key="file.href"
                    :value="file.href"
                  >
                    {{ file.name }}
                  </option>
                </select>
              </label>
              <Button
                as="a"
                :href="graphSource"
                :download="workflow.downloadName ?? true"
                variant="outline"
                class="h-auto min-h-11 max-w-full whitespace-normal"
                @click="emit('download')"
                >{{ t('workshop.workflow.download') }}</Button
              >
            </div>
            <WorkflowNodeGraphFacts
              :workflow="workflow"
              :needs="needs"
              :locale="locale"
            />
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
