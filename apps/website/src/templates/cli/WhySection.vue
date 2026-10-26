<script setup lang="ts">
import ReasonsSplit01 from '@/components/blocks/ReasonsSplit01.vue'
import type { Reason } from '@/components/blocks/ReasonsSplit01.vue'
import { getRoutes } from '@/config/routes'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { I18nT } from 'vue-i18n'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const reasonNumbers = [1, 2, 3, 4, 5] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`cli.why.${n}.title`),
  description: t(`cli.why.${n}.description`)
}))

const MCP_REASON_ID = '5'
</script>

<template>
  <ReasonsSplit01 :subtitle="t('cli.why.subtitle')" :reasons="reasons">
    <template #heading>
      <I18nT keypath="cli.why.headline" :i18n="translationsFor(locale)">
        <template #highlight>
          <span class="text-primary-comfy-yellow">{{
            t('cli.why.headingHighlight')
          }}</span>
        </template>
      </I18nT>
    </template>
    <template #reason-extra="{ reason }">
      <a
        v-if="reason.id === MCP_REASON_ID"
        :href="getRoutes(locale).mcp"
        class="mt-4 inline-block rounded-sm text-xs font-bold tracking-wider text-primary-comfy-yellow uppercase underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-primary-comfy-yellow/50 focus-visible:outline-none"
      >
        {{ t('cli.why.mcpLinkLabel') }}
      </a>
    </template>
  </ReasonsSplit01>
</template>
