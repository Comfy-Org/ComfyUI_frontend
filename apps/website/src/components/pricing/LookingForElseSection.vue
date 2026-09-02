<script setup lang="ts">
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import FeatureCard from '../../templates/platform/FeatureCard.vue'
import SectionHeader from '../common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('pricing.lookingForElse.heading', locale) }}
    </SectionHeader>

    <FeatureCard
      class="mx-auto mt-8 max-w-md"
      :title="t('pricing.lookingForElse.community.title', locale)"
      :description="t('pricing.lookingForElse.community.description', locale)"
    >
      <div class="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <a
          :href="externalLinks.github"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
        >
          {{ t('pricing.lookingForElse.community.github', locale) }}
        </a>
        <a
          :href="externalLinks.docsSelfHosted"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 rounded-sm text-sm underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
        >
          {{ t('pricing.lookingForElse.community.docs', locale) }}
        </a>
      </div>
    </FeatureCard>
  </section>
</template>
