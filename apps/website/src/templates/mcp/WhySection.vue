<script setup lang="ts">
import ReasonsSplit01 from '@/components/blocks/ReasonsSplit01.vue'
import type { Reason } from '@/components/blocks/ReasonsSplit01.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { I18nT } from 'vue-i18n'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const reasonNumbers = [1, 2, 3, 4] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`mcp.why.${n}.title`),
  description: t(`mcp.why.${n}.description`)
}))
</script>

<template>
  <ReasonsSplit01 :subtitle="t('mcp.why.subtitle')" :reasons="reasons">
    <template #heading>
      <I18nT keypath="mcp.why.headline" :i18n="translationsFor(locale)">
        <template #highlight>
          <span class="text-primary-comfy-yellow">{{
            t('mcp.why.headingHighlight')
          }}</span>
        </template>
      </I18nT>
    </template>
  </ReasonsSplit01>
</template>
