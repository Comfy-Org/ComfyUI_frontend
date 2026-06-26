<script setup lang="ts">
import FeatureRows01 from '../../components/blocks/FeatureRows01.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const tools = [
  { n: 1, image: 'https://media.comfy.org/website/mcp/tool-generate.webp' },
  { n: 2, image: 'https://media.comfy.org/website/mcp/tool-search.webp' },
  { n: 3, image: 'https://media.comfy.org/website/mcp/tool-workflow.webp' }
] as const

const rows = tools.map(({ n, image }) => ({
  id: String(n),
  title: t(`mcp.tools.${n}.title`, locale),
  description: t(`mcp.tools.${n}.description`, locale),
  image
}))
</script>

<template>
  <FeatureRows01 :heading="t('mcp.tools.heading', locale)" :rows="rows" />
</template>
