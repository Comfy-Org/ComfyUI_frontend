<script setup lang="ts">
import SectionLabel from '../../components/common/SectionLabel.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

interface SetupStep {
  id: string
  label: string
  title: string
  description: string
  cta?: { label: string; href: string }
  url?: string
}

const steps: SetupStep[] = [
  {
    id: 'step1',
    label: t('mcp.setup.step1.label', locale),
    title: t('mcp.setup.step1.title', locale),
    description: t('mcp.setup.step1.description', locale),
    cta: {
      label: t('mcp.setup.step1.cta', locale),
      href: `${externalLinks.cloud}/settings/connections`
    }
  },
  {
    id: 'step2',
    label: t('mcp.setup.step2.label', locale),
    title: t('mcp.setup.step2.title', locale),
    description: t('mcp.setup.step2.description', locale),
    url: t('mcp.setup.step2.urlPlaceholder', locale)
  },
  {
    id: 'step3',
    label: t('mcp.setup.step3.label', locale),
    title: t('mcp.setup.step3.title', locale),
    description: t('mcp.setup.step3.description', locale)
  }
]
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-24 lg:px-20">
    <div class="mb-10">
      <SectionLabel>{{ t('mcp.setup.label', locale) }}</SectionLabel>
      <h2
        class="mt-4 text-3xl font-light text-primary-comfy-canvas lg:text-5xl/tight"
      >
        {{ t('mcp.setup.heading', locale) }}
      </h2>
      <p class="mt-4 max-w-xl text-sm text-smoke-700 lg:text-base">
        {{ t('mcp.setup.subtitle', locale) }}
      </p>
    </div>

    <div class="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div
        v-for="step in steps"
        :key="step.id"
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ step.label }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ step.title }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ step.description }}
        </p>

        <div v-if="step.cta" class="mt-6">
          <a
            :href="step.cta.href"
            target="_blank"
            rel="noopener noreferrer"
            class="border-primary-comfy-yellow text-primary-comfy-yellow inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold tracking-wider uppercase"
          >
            {{ step.cta.label }}
            <span aria-hidden="true">›</span>
          </a>
        </div>

        <div
          v-else-if="step.url"
          class="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span class="flex-1 truncate font-mono text-xs text-smoke-700">
            {{ step.url }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
