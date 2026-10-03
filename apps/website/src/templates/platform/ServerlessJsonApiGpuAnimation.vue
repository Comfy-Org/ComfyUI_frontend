<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'

import type { Locale } from '../../i18n/translations'
import { translationsFor } from '../../i18n/translations'

const { locale = 'en', compact = false } = defineProps<{
  locale?: Locale
  compact?: boolean
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div
    :class="
      cn(
        'relative aspect-16/7 min-h-[207px] w-full overflow-hidden rounded-3xl bg-primary-comfy-ink',
        compact ? 'lg:min-h-72' : 'lg:aspect-4/3 lg:min-h-96'
      )
    "
  >
    <iframe
      :title="t('platform.serverlessHero.animationTitle')"
      :src="`/assets/platform/serverless/json-api-gpu-animation.html?v=astronaut-quality-2${compact ? '&layout=compact' : ''}`"
      class="absolute inset-0 size-full border-0"
      loading="eager"
      sandbox="allow-scripts"
      tabindex="-1"
    />
  </div>
</template>
