<script setup lang="ts">
import SectionHeader from '../../components/common/SectionHeader.vue'
import VideoPlayer from '../../components/common/VideoPlayer.vue'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <section class="max-w-9xl mx-auto px-6 py-16 lg:py-24">
    <SectionHeader max-width="xl">
      {{ t('cli.session.heading', locale) }}
      <template #subtitle>
        <p class="mt-4 text-sm text-smoke-700 lg:text-base">
          {{ t('cli.session.subtitle', locale) }}
        </p>
      </template>
    </SectionHeader>

    <!-- The wrapper carries the recording's native 1284x910 aspect and the
         player is pinned to it, overriding VideoPlayer's 16:9 default so no
         terminal rows are cropped (same pattern as the MCP setup clips). -->
    <div
      class="relative mx-auto mt-12 aspect-1284/910 w-full max-w-4xl overflow-hidden lg:mt-16"
    >
      <VideoPlayer
        :locale="locale"
        :aria-label="t('cli.session.alt', locale)"
        src="https://media.comfy.org/website/cli/terminal-session-v2-1280.mp4"
        poster="https://media.comfy.org/website/cli/terminal-session-v2-poster.jpg"
        autoplay
        lazy-autoplay
        loop
        mute-only
        fit="contain"
        class="absolute inset-0 size-full"
      />
    </div>

    <p class="sr-only">{{ t('cli.session.transcript', locale) }}</p>
  </section>
</template>
