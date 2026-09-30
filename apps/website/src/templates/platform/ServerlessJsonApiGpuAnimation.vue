<script setup lang="ts">
import { onMounted, ref } from 'vue'

import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <div
    class="relative aspect-16/7 min-h-[207px] w-full overflow-hidden rounded-3xl bg-primary-comfy-ink lg:aspect-4/3 lg:min-h-96"
  >
    <iframe
      v-if="mounted"
      :title="t('platform.serverlessHero.animationTitle', locale)"
      src="/assets/platform/serverless/json-api-gpu-animation.html"
      class="absolute inset-0 size-full border-0"
      loading="eager"
      sandbox="allow-scripts"
      tabindex="-1"
    />
  </div>
</template>
