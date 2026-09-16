<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  downloadUrl,
  tutorialUrl,
  weights,
  customNodes,
  callsPartnerModel,
  destination,
  locale = 'en'
} = defineProps<{
  downloadUrl: string
  tutorialUrl: string | undefined
  /** Rounded to what a reader decides on, or absent for a partner workflow. */
  weights: string | undefined
  customNodes: readonly string[]
  callsPartnerModel: boolean
  destination: WorkshopModel | undefined
  locale?: Locale
}>()

const sectionTitle =
  'text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase'
const panel =
  'rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4 p-5'
const secondary =
  'text-primary-warm-gray transition-colors hover:text-primary-warm-white'
</script>

<template>
  <aside class="flex flex-col gap-5 lg:sticky lg:top-28 lg:self-start">
    <div :class="panel" data-testid="workflow-actions">
      <a
        :href="downloadUrl"
        target="_blank"
        rel="noopener"
        class="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary-comfy-yellow px-5 text-sm font-bold tracking-wider text-primary-comfy-ink uppercase transition-opacity hover:opacity-90"
      >
        {{ t('workshop.v2.action.open', locale) }}
      </a>
      <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a :href="downloadUrl" download :class="secondary">
          {{ t('workshop.v2.workflow.download', locale) }}
        </a>
        <a
          v-if="tutorialUrl"
          :href="tutorialUrl"
          target="_blank"
          rel="noopener"
          :class="secondary"
        >
          {{ t('workshop.v2.workflow.tutorial', locale) }}
        </a>
      </div>
    </div>

    <div :class="panel" data-testid="workflow-needs">
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
    </div>

    <!-- The one crossing back to a model, and the sentence that keeps it
      honest: the graph opens in ComfyUI, the model is what runs here. -->
    <div v-if="destination" :class="panel" data-testid="workflow-destination">
      <h2 :class="sectionTitle">
        {{
          t('workshop.v2.workflow.runHere', locale).replace(
            '{model}',
            destination.name
          )
        }}
      </h2>
      <p class="mt-2 text-sm text-content-muted">
        {{ t('workshop.v2.workflow.runHereNote', locale) }}
      </p>
      <a
        :href="destination.href"
        class="mt-4 inline-flex h-10 items-center justify-center rounded-2xl border border-primary-comfy-yellow px-5 text-xs font-bold tracking-wider text-primary-comfy-yellow uppercase transition-colors hover:bg-primary-comfy-yellow hover:text-primary-comfy-ink"
      >
        {{ t('workshop.v2.action.run', locale) }}
      </a>
    </div>
  </aside>
</template>
