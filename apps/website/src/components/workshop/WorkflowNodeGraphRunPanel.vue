<script setup lang="ts">
import { ArrowUpRight, Box, Download, Puzzle } from '@lucide/vue'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const cloudHref = computed(
  () =>
    `${WORKSHOP_CLOUD_BASE_URL}/?template=${encodeURIComponent(workflow.templateId)}`
)

const panelHeadingClass =
  'border-b border-transparency-white-t8 px-5 py-3 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const factHeadingClass =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<!-- Where a runnable workflow keeps its inputs and Run, this one says what
  running it takes and offers the two ways to do it. -->
<template>
  <section
    class="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
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
</template>
