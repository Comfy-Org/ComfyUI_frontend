<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { t } from '../../../i18n/translations'
import GlassCard from '../../common/GlassCard.vue'
import SectionHeader from '../../common/SectionHeader.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const tools = [
  {
    titleKey: 'mcp.tools.1.title',
    descriptionKey: 'mcp.tools.1.description',
    image: 'https://media.comfy.org/website/mcp/tool-generate.webp'
  },
  {
    titleKey: 'mcp.tools.2.title',
    descriptionKey: 'mcp.tools.2.description',
    image: 'https://media.comfy.org/website/mcp/tool-search.webp'
  },
  {
    titleKey: 'mcp.tools.3.title',
    descriptionKey: 'mcp.tools.3.description',
    image: 'https://media.comfy.org/website/mcp/tool-workflow.webp'
  }
] as const
</script>

<template>
  <section class="max-w-9xl mx-auto px-4 py-24 lg:px-20">
    <SectionHeader max-width="xl">
      {{ t('mcp.tools.heading', locale) }}
    </SectionHeader>

    <div class="mt-16 flex flex-col gap-4 lg:gap-6">
      <GlassCard
        v-for="(tool, i) in tools"
        :key="tool.titleKey"
        class="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-0"
      >
        <!-- Text -->
        <div
          :class="[
            'order-2 flex flex-col justify-center gap-4 p-6 lg:w-1/2 lg:p-12',
            i % 2 === 0 ? 'lg:order-1' : 'lg:order-2'
          ]"
        >
          <h3 class="text-2xl font-light text-primary-comfy-canvas lg:text-3xl">
            {{ t(tool.titleKey, locale) }}
          </h3>
          <p class="text-sm text-smoke-700 lg:text-base">
            {{ t(tool.descriptionKey, locale) }}
          </p>
        </div>

        <!-- Image -->
        <div
          :class="[
            'order-1 lg:w-1/2',
            i % 2 === 0 ? 'lg:order-2' : 'lg:order-1'
          ]"
        >
          <img
            :src="tool.image"
            :alt="t(tool.titleKey, locale)"
            class="aspect-4/3 w-full rounded-4xl object-cover"
          />
        </div>
      </GlassCard>
    </div>
  </section>
</template>
