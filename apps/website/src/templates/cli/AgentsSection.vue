<script setup lang="ts">
import SectionHeader from '@/components/common/SectionHeader.vue'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

// Every claim maps to a documented surface: the --json envelope, the
// `comfy --json discover` contract dump, and workflow-file runs
// (docs.comfy.org/comfy-cli/getting-started).
const features: {
  id: string
  command: string
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}[] = [
  {
    id: 'json',
    command: '--json',
    titleKey: 'cli.agents.1.title',
    descriptionKey: 'cli.agents.1.description'
  },
  {
    id: 'discover',
    command: 'comfy --json discover',
    titleKey: 'cli.agents.2.title',
    descriptionKey: 'cli.agents.2.description'
  },
  {
    id: 'workflows',
    command: 'comfy run --workflow',
    titleKey: 'cli.agents.3.title',
    descriptionKey: 'cli.agents.3.description'
  }
]
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-16 lg:py-24">
    <SectionHeader max-width="xl" :label="t('cli.agents.label')">
      {{ t('cli.agents.heading') }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
          {{ t('cli.agents.subtitle') }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-12 grid grid-cols-1 gap-6 lg:mt-16 lg:grid-cols-3">
      <article
        v-for="feature in features"
        :key="feature.id"
        class="flex min-w-0 flex-col gap-5 rounded-3xl bg-transparency-white-t4 p-6 lg:p-8"
      >
        <p
          class="self-start rounded-lg bg-transparency-white-t4 px-3 py-1.5 font-mono text-2xs/relaxed wrap-anywhere text-primary-comfy-yellow sm:text-xs/relaxed lg:text-sm/relaxed"
        >
          {{ feature.command }}
        </p>
        <h3 class="text-2xl font-light text-primary-comfy-canvas">
          {{ t(feature.titleKey) }}
        </h3>
        <p class="text-sm/relaxed text-smoke-700">
          {{ t(feature.descriptionKey) }}
        </p>
      </article>
    </div>
  </section>
</template>
