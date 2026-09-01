<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

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
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader
      max-width="xl"
      :label="t('cli.agents.label', locale)"
      align="start"
    >
      {{ t('cli.agents.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
          {{ t('cli.agents.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <article
        v-for="feature in features"
        :key="feature.id"
        class="border-primary-comfy-yellow flex flex-col gap-5 rounded-[40px] border-2 bg-primary-comfy-ink p-8 lg:p-10"
      >
        <p
          class="text-primary-comfy-yellow self-start rounded-lg bg-white/8 px-3 py-1.5 font-mono text-xs"
        >
          {{ feature.command }}
        </p>
        <h3 class="text-2xl font-light text-primary-comfy-canvas">
          {{ t(feature.titleKey, locale) }}
        </h3>
        <p class="text-sm text-primary-comfy-canvas/70">
          {{ t(feature.descriptionKey, locale) }}
        </p>
      </article>
    </div>
  </section>
</template>
