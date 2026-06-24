<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { externalLinks } from '../../../config/routes'
import { t } from '../../../i18n/translations'
import SectionLabel from '../../common/SectionLabel.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const steps = [
  {
    labelKey: 'mcp.setup.step1.label',
    titleKey: 'mcp.setup.step1.title',
    descriptionKey: 'mcp.setup.step1.description'
  },
  {
    labelKey: 'mcp.setup.step2.label',
    titleKey: 'mcp.setup.step2.title',
    descriptionKey: 'mcp.setup.step2.description'
  },
  {
    labelKey: 'mcp.setup.step3.label',
    titleKey: 'mcp.setup.step3.title',
    descriptionKey: 'mcp.setup.step3.description'
  }
] as const
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
      <!-- Step 1 -->
      <div
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('mcp.setup.step1.label', locale) }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ t('mcp.setup.step1.title', locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t('mcp.setup.step1.description', locale) }}
        </p>
        <div class="mt-6">
          <a
            :href="`${externalLinks.cloud}/settings/connections`"
            target="_blank"
            rel="noopener noreferrer"
            class="border-primary-comfy-yellow text-primary-comfy-yellow inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-xs font-bold tracking-wider uppercase"
          >
            {{ t('mcp.setup.step1.cta', locale) }}
            <span aria-hidden="true">›</span>
          </a>
        </div>
      </div>

      <!-- Step 2 -->
      <div
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('mcp.setup.step2.label', locale) }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ t('mcp.setup.step2.title', locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t('mcp.setup.step2.description', locale) }}
        </p>
        <div
          class="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span class="flex-1 truncate font-mono text-xs text-smoke-700">
            {{ t('mcp.setup.step2.urlPlaceholder', locale) }}
          </span>
        </div>
      </div>

      <!-- Step 3 -->
      <div
        class="bg-transparency-white-t4 flex flex-col rounded-3xl p-6 lg:p-8"
      >
        <p
          class="text-primary-comfy-yellow text-xs font-bold tracking-widest uppercase"
        >
          {{ t('mcp.setup.step3.label', locale) }}
        </p>
        <h3
          class="mt-3 text-xl font-light text-primary-comfy-canvas lg:text-2xl"
        >
          {{ t('mcp.setup.step3.title', locale) }}
        </h3>
        <p class="mt-3 text-sm text-smoke-700">
          {{ t('mcp.setup.step3.description', locale) }}
        </p>
      </div>
    </div>
  </section>
</template>
