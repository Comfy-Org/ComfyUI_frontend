<script setup lang="ts">
import SectionHeader from '@/components/common/SectionHeader.vue'
import NativeCliSession from './NativeCliSession.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)
</script>

<template>
  <section
    id="session"
    class="mx-auto max-w-9xl scroll-mt-36 px-6 py-16 lg:py-24"
  >
    <SectionHeader max-width="xl">
      {{ t('cli.session.heading') }}
      <template #subtitle>
        <p class="mx-auto mt-4 max-w-2xl text-sm text-smoke-700 lg:text-base">
          {{ t('cli.session.subtitle') }}
        </p>
      </template>
    </SectionHeader>

    <div class="mx-auto mt-12 w-full max-w-4xl lg:mt-16">
      <NativeCliSession :locale="locale" />
    </div>

    <p class="sr-only">
      {{ t('cli.session.transcript') }}
    </p>
  </section>
</template>
