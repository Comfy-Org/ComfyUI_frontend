<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { routerCodeTabs } from './codeSamples'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="mx-auto max-w-4xl px-6 py-10 lg:py-14">
    <h2
      class="text-center text-2xl/tight font-light text-primary-comfy-canvas lg:text-3xl/tight"
    >
      {{ t('platform.router.code.heading', locale) }}
    </h2>
    <div class="mt-8">
      <CodeTabs
        :tabs="routerCodeTabs"
        :label="t('platform.router.code.heading', locale)"
        content-class="bg-[#2a2230]"
        :copy-label="t('ui.copy', locale)"
        :copied-label="t('ui.copied', locale)"
      />
    </div>
    <p class="mt-6 text-center text-sm text-primary-comfy-canvas/70">
      {{ t('platform.router.code.supporting', locale) }}
    </p>
  </section>
</template>
