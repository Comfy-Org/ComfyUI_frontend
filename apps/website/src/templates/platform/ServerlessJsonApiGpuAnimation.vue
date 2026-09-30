<script setup lang="ts">
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
</script>

<template>
  <div
    class="relative aspect-16/7 min-h-[207px] w-full overflow-hidden rounded-3xl bg-primary-comfy-ink lg:min-h-72"
  >
    <iframe
      :title="t('platform.serverlessHero.animationTitle', locale)"
      src="/assets/platform/serverless/json-api-gpu-animation.html"
      class="size-full border-0"
      loading="eager"
      sandbox="allow-scripts"
      tabindex="-1"
    />
  </div>
</template>
