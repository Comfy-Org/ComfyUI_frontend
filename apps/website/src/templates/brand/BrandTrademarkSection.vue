<script setup lang="ts">
import type { Locale } from '@/i18n/translations'

import SectionHeader from '@/components/common/SectionHeader.vue'
import Button from '@/components/ui/button/Button.vue'
import { externalLinks } from '@/config/routes.ts'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section class="mx-auto max-w-9xl px-6 py-10 lg:px-20 lg:py-12">
    <SectionHeader align="start" max-width="xl">
      {{ t('brand.trademark.heading') }}
    </SectionHeader>

    <div
      class="mt-6 flex max-w-4xl flex-col gap-4 text-sm/[1.6] text-primary-warm-gray"
    >
      <p>{{ t('brand.trademark.body1') }}</p>
      <p>{{ t('brand.trademark.body2') }}</p>
      <p>
        {{ t('brand.trademark.body3') }}
        <Button
          as="a"
          variant="inline"
          :href="externalLinks.support"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('brand.trademark.contact') }}
        </Button>
      </p>
    </div>
  </section>
</template>
