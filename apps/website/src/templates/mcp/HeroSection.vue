<script setup lang="ts">
import HeroSplit01 from '@/components/blocks/HeroSplit01.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ComfyMcpDemo from './ComfyMcpDemo.vue'
import { mcpCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const { t } = translationsFor(locale)

const ctas = mcpCtas(locale)
</script>

<template>
  <HeroSplit01
    :locale="locale"
    class="min-h-[calc(100svh-5rem)] lg:min-h-0 lg:items-start lg:pt-14"
    badge-text="MCP"
    :title="t('mcp.hero.heading')"
    :subtitle="t('mcp.hero.subtitle')"
    :primary-cta="ctas.installMcp"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <ComfyMcpDemo :locale="locale" />
    </template>
  </HeroSplit01>
</template>
