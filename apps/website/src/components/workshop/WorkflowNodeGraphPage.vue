<script setup lang="ts">
import { ArrowUpRight, ChevronLeft, Download, ImageIcon } from '@lucide/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'

import FAQSection from '@/components/common/FAQSection.vue'
import Button from '@/components/ui/button/Button.vue'
import { useStickyFooterScrollPadding } from '@/composables/useStickyFooterScrollPadding'
import { useTablist } from '@/composables/useTablist'
import { getRoutes } from '@/config/routes'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

import ExamplesTab from './ExamplesTab.vue'
import SectionHeading from './SectionHeading.vue'
import WorkflowGraph from './WorkflowGraph.vue'
import WorkflowNodeGraphApi from './WorkflowNodeGraphApi.vue'
import WorkflowNodeGraphFacts from './WorkflowNodeGraphFacts.vue'

const {
  workflow,
  locale = 'en',
  cloudAvailable = true
} = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
  /** False when a licence keeps the workflow off Comfy Cloud. */
  cloudAvailable?: boolean
}>()
const { t } = translationsFor(locale)
const routes = getRoutes()

const cloudHref = computed(() =>
  cloudAvailable
    ? `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(workflow.templateId)}`
    : undefined
)
const samples = computed(() =>
  workflow.examples
    .filter((example) => example.mediaKind !== 'video')
    .slice(0, 1)
    .map((example) => example.outputUrl)
)

// The same tabs as a runnable workflow. The Playground becomes an Overview
// of what the workflow makes, since it cannot run here.
const sections = ['overview', 'workflow', 'api'] as const
const section = ref<(typeof sections)[number]>('overview')
const { onKeydown } = useTablist(() => sections, section)
const sectionLabels = {
  overview: 'workshop.nodeGraph.tabOverview',
  workflow: 'workshop.model.tabs.details',
  api: 'workshop.nodeGraph.tabApi'
} as const
// Like Run, the footer's action stays in view while the panel scrolls past.
const footer = useTemplateRef<HTMLElement>('footer')
useStickyFooterScrollPadding(footer, () => section.value === 'overview')

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

const expanded = ref(false)
const [lead, ...more] = workflow.description

const pillClass =
  'inline-flex h-7 items-center rounded-full border border-transparency-white-t20 px-3 text-xs leading-none text-primary-comfy-canvas transition-colors hover:border-primary-comfy-yellow hover:text-primary-comfy-yellow'
const panelHeadingClass =
  'border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const labelClass =
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
      <!-- Try in Cloud leads when Cloud can open it; otherwise Download is
        the only way in, so it takes the primary style. -->
      <div
        class="mt-6 flex flex-wrap items-center gap-2"
        data-testid="workflow-actions"
      >
        <Button
          v-if="cloudHref"
          as="a"
          :href="cloudHref"
          target="_blank"
          rel="noopener"
          class="h-auto min-h-11 max-w-full font-bold tracking-wider whitespace-normal"
          data-testid="node-graph-try-cloud"
          >{{ t('workshop.workflow.tryCloud') }}
          <template #append>
            <ArrowUpRight aria-hidden="true" />
          </template>
        </Button>
        <Button
          as="a"
          :href="workflow.downloadUrl"
          download
          :variant="cloudHref ? 'secondaryOutline' : 'default'"
          class="h-auto min-h-11 max-w-full whitespace-normal"
          :aria-label="t('workshop.workflow.download')"
          data-testid="node-graph-download"
          >{{ t('workshop.workflow.downloadShort') }}</Button
        >
      </div>
    </header>

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

    <!-- Overview: the Playground's two panels, read-only. -->
    <div
      v-show="section === 'overview'"
      id="workflow-panel-overview"
      role="tabpanel"
      aria-labelledby="workflow-tab-overview"
      data-testid="node-graph-overview"
    >
      <div class="grid gap-8 lg:grid-cols-12">
        <section
          class="flex min-w-0 flex-col rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 lg:col-span-5"
          aria-labelledby="workflow-about-heading"
          data-testid="node-graph-about"
        >
          <h2 id="workflow-about-heading" :class="panelHeadingClass">
            {{ t('workshop.nodeGraph.about') }}
          </h2>
          <div class="space-y-6 p-5">
            <div class="space-y-3 text-sm/relaxed text-primary-comfy-canvas">
              <p>{{ lead }}</p>
              <template v-if="expanded">
                <p v-for="paragraph in more" :key="paragraph">
                  {{ paragraph }}
                </p>
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

            <div v-if="workflow.inputs.length" data-testid="node-graph-inputs">
              <h3 :class="labelClass">{{ t('workshop.nodeGraph.provide') }}</h3>
              <ul class="mt-3 flex flex-wrap gap-2">
                <li
                  v-for="input in workflow.inputs"
                  :key="input"
                  class="inline-flex h-8 items-center rounded-lg border border-transparency-white-t8 bg-transparency-white-t4 px-3 text-sm text-primary-comfy-canvas"
                >
                  {{ input }}
                </li>
              </ul>
            </div>
          </div>

          <!-- Where the Playground has Run. -->
          <div
            ref="footer"
            class="sticky bottom-0 z-10 mt-auto space-y-3 rounded-b-2xl border-t border-transparency-white-t8 bg-page/85 p-3 backdrop-blur-sm"
            data-testid="node-graph-footer"
          >
            <p class="px-1 text-sm text-primary-warm-gray">
              <span class="font-bold text-primary-comfy-canvas"
                >{{ t('workshop.nodeGraph.runsHereTitle') }}.</span
              >
              {{
                t(
                  cloudHref
                    ? 'workshop.nodeGraph.runsHereCloud'
                    : 'workshop.nodeGraph.runsHereLocal'
                )
              }}
            </p>
            <Button
              v-if="cloudHref"
              as="a"
              :href="cloudHref"
              target="_blank"
              rel="noopener"
              class="min-h-11 w-full font-bold tracking-wider"
              >{{ t('workshop.workflow.tryCloud') }}
              <template #append>
                <ArrowUpRight aria-hidden="true" />
              </template>
            </Button>
            <Button
              v-else
              as="a"
              :href="workflow.downloadUrl"
              download
              class="min-h-11 w-full"
              >{{ t('workshop.workflow.downloadShort') }}
              <template #append>
                <Download aria-hidden="true" />
              </template>
            </Button>
          </div>
        </section>

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

    <div
      v-show="section === 'api'"
      id="workflow-panel-api"
      role="tabpanel"
      aria-labelledby="workflow-tab-api"
    >
      <WorkflowNodeGraphApi
        :workflow="workflow"
        :cloud="cloudAvailable"
        :locale="locale"
      />
    </div>
  </div>
  <FAQSection
    v-if="workflow.faq.length"
    :heading="t('workshop.nodeGraph.faqHeading')"
    :items="workflow.faq"
    :locale="locale"
  />
</template>
