<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { endpointCodeTabs } from './codeSamples'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.serverless.codeHeading', locale) }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700">
          {{ t('platform.serverless.codeSubtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="endpointCodeTabs"
        :aria-label="t('platform.serverless.codeHeading', locale)"
      />
    </div>
  </section>
</template>
