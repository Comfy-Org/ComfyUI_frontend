<script setup lang="ts">
import { Box, Puzzle } from '@lucide/vue'
import { computed } from 'vue'

import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { NodeGraphWorkflow } from '@/lib/hub/node-graph-workflow'

const { workflow, locale = 'en' } = defineProps<{
  workflow: NodeGraphWorkflow
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const facts = computed(() => {
  const rows: { label: TranslationKey; value: string }[] = [
    {
      label: 'workshop.workflow.factWhere',
      value: t('workshop.nodeGraph.runsWhere')
    }
  ]
  if (workflow.output)
    rows.push({ label: 'workshop.workflow.factOutput', value: workflow.output })
  if (workflow.author)
    rows.push({ label: 'workshop.workflow.factAuthor', value: workflow.author })
  return rows
})

const headingClass =
  'text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    data-testid="workflow-facts"
  >
    <section
      v-if="workflow.models.length"
      class="px-5 py-4"
      data-testid="workflow-runs-on"
    >
      <h3 :class="headingClass">{{ t('workshop.workflow.runsOn') }}</h3>
      <ul class="mt-2 flex flex-col gap-1">
        <li
          v-for="name in workflow.models"
          :key="name"
          class="flex items-center gap-2.5 py-1.5"
        >
          <Box
            class="size-4 shrink-0 text-primary-warm-gray"
            aria-hidden="true"
          />
          <span
            class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
          >
            {{ name }}
          </span>
        </li>
      </ul>
    </section>

    <section
      v-if="workflow.customNodes.length"
      class="border-t border-transparency-white-t8 px-5 py-4 first:border-t-0"
      data-testid="workflow-custom-nodes"
    >
      <h3 :class="headingClass">{{ t('workshop.workflow.customNodes') }}</h3>
      <ul class="mt-2 flex flex-col gap-1">
        <li
          v-for="name in workflow.customNodes"
          :key="name"
          class="flex items-center gap-2.5 py-1.5"
        >
          <Puzzle
            class="size-4 shrink-0 text-primary-warm-gray"
            aria-hidden="true"
          />
          <span
            class="min-w-0 flex-1 truncate text-base text-primary-comfy-canvas"
          >
            {{ name }}
          </span>
        </li>
      </ul>
    </section>

    <section
      class="border-t border-transparency-white-t8 px-5 py-4 first:border-t-0"
      data-testid="workflow-details"
    >
      <dl class="flex flex-col gap-1 text-sm">
        <div
          v-for="fact in facts"
          :key="fact.label"
          class="grid grid-cols-[6rem_1fr] gap-4"
        >
          <dt class="text-primary-warm-gray">{{ t(fact.label) }}</dt>
          <dd class="min-w-0 truncate text-primary-comfy-canvas tabular-nums">
            {{ fact.value }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
