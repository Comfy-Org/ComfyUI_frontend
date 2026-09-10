<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import CodeTabs from './CodeTabs.vue'
import { routerCodeTabs } from './codeSamples'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-10 lg:py-14">
    <SectionHeader max-width="xl" heading-size="compact">
      {{ t('platform.router.codeBlock.header', locale) }}
    </SectionHeader>

    <div class="mx-auto mt-8 max-w-3xl">
      <CodeTabs
        :tabs="routerCodeTabs"
        :label="t('platform.router.codeBlock.header', locale)"
        content-class="bg-[#2a2230]"
      />
    </div>
  </section>
</template>
