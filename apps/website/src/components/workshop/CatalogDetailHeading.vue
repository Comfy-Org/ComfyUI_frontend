<script setup lang="ts">
import type { WorkshopModel } from '@/config/models-catalogue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
const { model, missing, workflow, locale } = defineProps<{
  model?: WorkshopModel
  missing: boolean
  workflow: boolean
  locale: Locale
}>()
const { t } = translationsFor(locale)
</script>
<template>
  <header class="mb-9" :data-testid="workflow ? 'workflow-hero' : 'model-hero'">
    <h1
      class="max-w-4xl text-3xl font-light text-primary-comfy-canvas lg:text-5xl"
    >
      <template v-if="model && !missing">{{ model.name }}</template>
      <template v-else-if="missing">{{
        t('cccCatalogPage.notFound')
      }}</template>
      <span
        v-else
        class="block h-12 w-2/3 animate-pulse rounded-sm bg-hub-surface"
        :aria-label="t('workshop.load.pending')"
      />
    </h1>
    <p
      v-if="model?.summary && !missing"
      class="mt-4 text-lg text-primary-warm-gray"
    >
      {{ model.summary }}
    </p>
  </header>
</template>
