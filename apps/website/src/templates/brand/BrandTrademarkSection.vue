<script setup lang="ts">
import type { Locale } from '../../i18n/translations'

import SectionHeader from '../../components/common/SectionHeader.vue'
import Button from '../../components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes.ts'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:px-20 lg:py-12">
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.trademark.heading', locale) }}
    </SectionHeader>

    <div
      class="text-primary-warm-gray mt-6 flex max-w-4xl flex-col gap-4 text-sm leading-[1.6]"
    >
      <p>{{ t('brand.trademark.body1', locale) }}</p>
      <p>{{ t('brand.trademark.body2', locale) }}</p>
      <p>
        {{ t('brand.trademark.body3', locale) }}
        <Button
          as="a"
          variant="inline"
          :href="externalLinks.support"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('brand.trademark.contact', locale) }}
        </Button>
      </p>
    </div>
  </section>
</template>
