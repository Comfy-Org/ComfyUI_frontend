<script setup lang="ts">
import { ArrowUpRight } from '@lucide/vue'

import FeatureGrid01 from '../../components/blocks/FeatureGrid01.vue'
import type { FeatureCard } from '../../components/blocks/FeatureGrid01.vue'
import { externalLinks } from '../../config/routes'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const cards: FeatureCard[] = [
  {
    id: 'step1',
    label: t('mcp.setup.step1.label', locale),
    title: t('mcp.setup.step1.title', locale),
    description: t('mcp.setup.step1.description', locale),
    actions: [
      {
        type: 'code',
        value: t('mcp.setup.step1.command', locale).replace(
          '{url}',
          externalLinks.docsMcp
        )
      }
    ]
  },
  {
    id: 'step2',
    label: t('mcp.setup.step2.label', locale),
    title: t('mcp.setup.step2.title', locale),
    description: t('mcp.setup.step2.description', locale),
    actions: [
      { type: 'code', value: externalLinks.mcpEndpoint },
      {
        type: 'link',
        label: t('mcp.setup.step2.cta', locale),
        href: externalLinks.docsMcp,
        target: '_blank',
        icon: ArrowUpRight,
        variant: 'default'
      }
    ]
  },
  {
    id: 'step3',
    label: t('mcp.setup.step3.label', locale),
    title: t('mcp.setup.step3.title', locale),
    description: t('mcp.setup.step3.description', locale),
    actions: [
      {
        type: 'link',
        label: t('mcp.setup.step3.cta', locale),
        href: externalLinks.mcpSkills,
        target: '_blank',
        icon: ArrowUpRight,
        variant: 'default'
      }
    ]
  }
]
</script>

<template>
  <FeatureGrid01
    id="setup"
    class="scroll-mt-24 lg:scroll-mt-36"
    :eyebrow="t('mcp.setup.label', locale)"
    :heading="t('mcp.setup.heading', locale)"
    :subtitle="t('mcp.setup.subtitle', locale)"
    :columns="3"
    :cards="cards"
    :copy-label="t('ui.copy', locale)"
    :copied-label="t('ui.copied', locale)"
  />
</template>
