<script setup lang="ts">
import type { WorkshopModel } from '../../config/models-catalogue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { models, locale = 'en' } = defineProps<{
  models: readonly { name: string; model: WorkshopModel | undefined }[]
  locale?: Locale
}>()
</script>

<template>
  <section data-testid="workflow-runs-on">
    <h2
      class="text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase"
    >
      {{ t('workshop.v2.workflow.runsOn', locale) }}
    </h2>
    <p class="mt-2 max-w-xl text-sm text-content-muted">
      {{ t('workshop.v2.workflow.runsOnNote', locale) }}
    </p>
    <ul class="mt-4 flex flex-wrap gap-2">
      <li v-for="ref in models" :key="ref.name">
        <a
          v-if="ref.model"
          :href="ref.model.href"
          class="inline-flex h-8 items-center gap-2 rounded-full bg-transparency-white-t8 px-4 text-sm text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 hover:text-primary-comfy-yellow"
        >
          {{ ref.name }}
        </a>
        <!-- A name we cannot open is a name, not a dead link. -->
        <span
          v-else
          class="inline-flex h-8 items-center gap-2 rounded-full border border-dashed border-transparency-white-t20 px-4 text-sm text-content-muted"
          data-testid="workflow-model-unlinked"
        >
          {{ ref.name }}
          <span class="text-2xs opacity-70">
            {{ t('workshop.v2.workflow.notInCatalogue', locale) }}
          </span>
        </span>
      </li>
    </ul>
  </section>
</template>
