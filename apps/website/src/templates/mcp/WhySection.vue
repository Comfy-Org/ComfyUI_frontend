<script setup lang="ts">
import ReasonSection from '../../components/product/shared/ReasonSection.vue'
import type { Locale, TranslationKey } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const reasons: Array<{
  titleKey: TranslationKey
  descriptionKey: TranslationKey
}> = [
  { titleKey: 'mcp.why.1.title', descriptionKey: 'mcp.why.1.description' },
  { titleKey: 'mcp.why.2.title', descriptionKey: 'mcp.why.2.description' },
  { titleKey: 'mcp.why.3.title', descriptionKey: 'mcp.why.3.description' },
  { titleKey: 'mcp.why.4.title', descriptionKey: 'mcp.why.4.description' }
]
</script>

<template>
  <ReasonSection
    :locale="locale"
    heading-key="mcp.why.heading"
    heading-highlight-key="mcp.why.headingHighlight"
    highlight-class="text-primary-comfy-yellow"
    subtitle-key="mcp.why.subtitle"
    :reasons="reasons"
  />
</template>
