<script setup lang="ts">
import { computed } from 'vue'

import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { HubPortSummary } from '../../lib/hub/workflow-detail'
import IconModel from './IconModel.vue'
import { mediaIcon, mediaLabel } from './mediaIcon'

const {
  brings,
  models,
  produces,
  locale = 'en'
} = defineProps<{
  brings: readonly HubPortSummary[]
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  produces: readonly HubPortSummary[]
  locale?: Locale
}>()

const perRun = (count: number) =>
  t('workshop.v2.workflow.perRun', locale).replace('{count}', String(count))

const describe = (ports: readonly HubPortSummary[]) =>
  ports.map((port) => ({
    key: port.media,
    label: mediaLabel(port.media, locale),
    meta: perRun(port.count),
    icon: mediaIcon(port.media)
  }))

// A graph that loads nothing off disk still takes the words you type.
const bringsRows = computed(() =>
  brings.length > 0
    ? describe(brings)
    : [
        {
          key: 'prompt',
          label: t('workshop.v2.workflow.bringsPrompt', locale),
          meta: undefined,
          icon: mediaIcon('text')
        }
      ]
)

const producesRows = computed(() => describe(produces))

const card = 'flex-1 rounded-2xl border border-transparency-white-t8'
const cardHeading =
  'border-b border-transparency-white-t8 bg-transparency-white-t4 px-4 py-2.5 text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
const row = 'flex items-start gap-3 px-4 py-3 text-sm'
const rowIcon = 'mt-0.5 size-4 shrink-0 text-primary-warm-gray'
const rowMeta = 'block text-xs text-primary-warm-gray'
</script>

<template>
  <section data-testid="workflow-how-it-works">
    <h2
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.v2.workflow.howItWorks', locale) }}
    </h2>

    <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-start">
      <div :class="card" data-testid="workflow-brings">
        <p :class="cardHeading">
          {{ t('workshop.v2.workflow.youBring', locale) }}
        </p>
        <ul class="divide-y divide-transparency-white-t8">
          <li v-for="item in bringsRows" :key="item.key" :class="row">
            <component :is="item.icon" :class="rowIcon" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block text-primary-comfy-canvas">
                {{ item.label }}
              </span>
              <span v-if="item.meta" :class="rowMeta">{{ item.meta }}</span>
            </span>
          </li>
        </ul>
      </div>

      <div
        v-if="models.length > 0"
        :class="card"
        data-testid="workflow-runs-on"
      >
        <p :class="cardHeading">
          {{ t('workshop.v2.workflow.runsOn', locale) }}
        </p>
        <ul class="divide-y divide-transparency-white-t8">
          <li v-for="ref in models" :key="ref.name" :class="row">
            <IconModel :class="rowIcon" aria-hidden="true" />
            <span class="min-w-0">
              <a
                v-if="ref.model"
                :href="ref.model.href"
                class="block text-primary-comfy-canvas transition-colors hover:text-primary-comfy-yellow"
              >
                {{ ref.name }}
              </a>
              <template v-else>
                <span class="block text-primary-comfy-canvas">
                  {{ ref.name }}
                </span>
                <span :class="rowMeta" data-testid="workflow-model-unlinked">
                  {{ t('workshop.v2.workflow.notInCatalogue', locale) }}
                </span>
              </template>
            </span>
          </li>
        </ul>
      </div>

      <div :class="card" data-testid="workflow-outputs">
        <p :class="cardHeading">
          {{ t('workshop.v2.workflow.youGet', locale) }}
        </p>
        <ul class="divide-y divide-transparency-white-t8">
          <li v-for="item in producesRows" :key="item.key" :class="row">
            <component :is="item.icon" :class="rowIcon" aria-hidden="true" />
            <span class="min-w-0">
              <span class="block text-primary-comfy-canvas">
                {{ item.label }}
              </span>
              <span :class="rowMeta">{{ item.meta }}</span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
