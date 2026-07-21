<script setup lang="ts">
import HeroSplit01 from '../../components/blocks/HeroSplit01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import ComfyMcpDemo from './ComfyMcpDemo.vue'
import { mcpCtas } from './ctas'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const ctas = mcpCtas(locale)
</script>

<template>
  <!-- 5rem/6.75rem = HeaderMain's rendered height (py-5 / lg:py-8) so the hero fills the viewport below the sticky nav -->
  <HeroSplit01
    :locale="locale"
    class="min-h-[calc(100svh-5rem)] lg:min-h-[calc(100svh-6.75rem)]"
    badge-text="MCP"
    :title="t('mcp.hero.heading', locale)"
    :subtitle="t('mcp.hero.subtitle', locale)"
    :primary-cta="ctas.installMcp"
    :secondary-cta="ctas.docs"
  >
    <template #media>
      <ComfyMcpDemo :locale="locale" />
    </template>
  </HeroSplit01>
</template>
