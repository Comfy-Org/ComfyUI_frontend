<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale } = defineProps<{ locale: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader max-width="xl">
      {{ t('mcp.useCases.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ t('mcp.useCases.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <VideoPlayer
      :locale="locale"
      :aria-label="t('mcp.useCases.alt', locale)"
      src="https://media.comfy.org/website/mcp/production-use-cases.mp4"
      poster="https://media.comfy.org/website/mcp/production-use-cases-poster.webp"
      minimal
      class="mt-12 lg:mt-16"
    />
  </section>
</template>
