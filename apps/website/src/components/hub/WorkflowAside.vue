<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  weights,
  customNodes,
  callsPartnerModel,
  locale = 'en'
} = defineProps<{
  /** Rounded to what a reader decides on, or absent for a partner workflow. */
  weights: string | undefined
  customNodes: readonly string[]
  callsPartnerModel: boolean
  locale?: Locale
}>()

const sectionTitle =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
</script>

<template>
  <aside
    class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-5"
    data-testid="workflow-needs"
  >
    <h2 :class="sectionTitle">
      {{ t('workshop.v2.workflow.needs', locale) }}
    </h2>
    <ul class="mt-3 flex flex-col gap-2 text-sm text-primary-comfy-canvas/80">
      <li>{{ t('workshop.v2.workflow.needsComfy', locale) }}</li>
      <li v-if="weights" data-testid="workflow-weights">
        {{
          t('workshop.v2.workflow.needsWeights', locale).replace(
            '{size}',
            weights
          )
        }}
      </li>
      <li v-else-if="callsPartnerModel">
        {{ t('workshop.v2.workflow.needsNothing', locale) }}
      </li>
      <li v-if="customNodes.length > 0" data-testid="workflow-custom-nodes">
        {{ t('workshop.v2.workflow.needsCustom', locale) }}
        <ul class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="node in customNodes"
            :key="node"
            class="inline-flex h-7 items-center rounded-full bg-transparency-white-t8 px-3 font-mono text-xs text-primary-comfy-canvas"
          >
            {{ node }}
          </li>
        </ul>
      </li>
    </ul>
  </aside>
</template>
