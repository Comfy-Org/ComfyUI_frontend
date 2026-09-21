<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import IconModel from './IconModel.vue'

const { models, locale = 'en' } = defineProps<{
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  locale?: Locale
}>()

// What goes in is the form above and what comes back is the output beside it,
// so the only thing left to say is which model answers.
const card = 'rounded-2xl border border-transparency-white-t8 sm:max-w-sm'
const cardHeading =
  'border-b border-transparency-white-t8 bg-transparency-white-t4 px-4 py-2.5 text-2xs font-bold tracking-wider text-primary-warm-gray uppercase'
const row = 'flex items-start gap-3 px-4 py-3 text-sm'
const rowIcon = 'mt-0.5 size-4 shrink-0 text-primary-warm-gray'
</script>

<template>
  <section v-if="models.length > 0" data-testid="workflow-how-it-works">
    <div :class="card" data-testid="workflow-runs-on">
      <p :class="cardHeading">
        {{ t('workshop.v2.workflow.runsOn', locale) }}
      </p>
      <ul class="divide-y divide-transparency-white-t8">
        <li v-for="ref in models" :key="ref.name" :class="row">
          <IconModel :class="rowIcon" aria-hidden="true" />
          <a
            v-if="ref.model"
            :href="ref.model.href"
            class="min-w-0 text-primary-comfy-canvas transition-colors hover:text-primary-comfy-yellow"
          >
            {{ ref.name }}
          </a>
          <span v-else class="min-w-0 text-primary-comfy-canvas">
            {{ ref.name }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>
