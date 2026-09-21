<script setup lang="ts">
import { Blocks, Layers, Server } from '@lucide/vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const {
  weights,
  models,
  customNodes,
  callsPartnerModel,
  locale = 'en'
} = defineProps<{
  /** Rounded to what a reader decides on, or absent for a partner workflow. */
  weights: string | undefined
  /** The models whose weights make up that download. */
  models: readonly string[]
  customNodes: readonly string[]
  callsPartnerModel: boolean
  locale?: Locale
}>()

const group = 'flex flex-col gap-2 px-5 py-4'
const groupHead = 'flex items-center gap-3 text-sm text-primary-comfy-canvas'
const count =
  'grid size-5 shrink-0 place-items-center rounded-md bg-transparency-white-t8 text-2xs font-bold text-primary-comfy-canvas tabular-nums'
const icon = 'size-4 shrink-0 text-primary-warm-gray'
const names = 'flex flex-col gap-1 pl-7 text-xs text-content-muted'
</script>

<template>
  <aside
    class="rounded-2xl border border-transparency-white-t8 bg-transparency-white-t4"
    data-testid="workflow-needs"
  >
    <div
      class="flex items-baseline justify-between gap-3 border-b border-transparency-white-t8 px-5 py-4"
    >
      <h2
        class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
      >
        {{ t('workshop.v2.workflow.needs', locale) }}
      </h2>
      <span
        v-if="weights"
        class="font-mono text-xs text-primary-warm-gray tabular-nums"
        data-testid="workflow-weights"
      >
        {{ weights }}
      </span>
    </div>

    <div class="divide-y divide-transparency-white-t8">
      <div :class="group">
        <p :class="groupHead">
          <Server :class="icon" aria-hidden="true" />
          {{ t('workshop.v2.workflow.needsComfy', locale) }}
        </p>
      </div>

      <div v-if="weights" :class="group" data-testid="workflow-needs-models">
        <p :class="groupHead">
          <Layers :class="icon" aria-hidden="true" />
          {{ t('workshop.v2.workflow.needsWeights', locale) }}
          <span :class="count">{{ models.length }}</span>
          <span
            class="ml-auto font-mono text-xs text-primary-warm-gray tabular-nums"
          >
            {{ weights }}
          </span>
        </p>
        <ul v-if="models.length > 0" :class="names">
          <li v-for="name in models" :key="name">{{ name }}</li>
        </ul>
      </div>

      <div v-else-if="callsPartnerModel" :class="group">
        <p :class="groupHead">
          <Layers :class="icon" aria-hidden="true" />
          {{ t('workshop.v2.workflow.needsNothing', locale) }}
        </p>
      </div>

      <div
        v-if="customNodes.length > 0"
        :class="group"
        data-testid="workflow-custom-nodes"
      >
        <p :class="groupHead">
          <Blocks :class="icon" aria-hidden="true" />
          {{ t('workshop.v2.workflow.needsCustom', locale) }}
          <span :class="count">{{ customNodes.length }}</span>
        </p>
        <ul :class="names">
          <li v-for="node in customNodes" :key="node" class="font-mono">
            {{ node }}
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>
