<script setup lang="ts">
import ReasonsSplit01 from '../../components/blocks/ReasonsSplit01.vue'
import type { Reason } from '../../components/blocks/ReasonsSplit01.vue'
import { getRoutes } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasonNumbers = [1, 2, 3, 4, 5] as const

const reasons: Reason[] = reasonNumbers.map((n) => ({
  id: String(n),
  title: t(`cli.why.${n}.title`, locale),
  description: t(`cli.why.${n}.description`, locale)
}))

const MCP_REASON_ID = '5'
</script>

<template>
  <ReasonsSplit01
    :heading="t('cli.why.heading', locale)"
    :heading-highlight="t('cli.why.headingHighlight', locale)"
    highlight-class="text-primary-comfy-yellow"
    :subtitle="t('cli.why.subtitle', locale)"
    :reasons="reasons"
  >
    <template #reason-extra="{ reason }">
      <a
        v-if="reason.id === MCP_REASON_ID"
        :href="getRoutes(locale).mcp"
        class="text-primary-comfy-yellow focus-visible:ring-primary-comfy-yellow/50 mt-4 inline-block rounded-sm text-xs font-bold tracking-wider uppercase underline underline-offset-4 transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:outline-none"
      >
        {{ t('cli.why.mcpLinkLabel', locale) }}
      </a>
    </template>
  </ReasonsSplit01>
</template>
