<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { Platform } from '../../../composables/useDownloadUrl'
import {
  downloadUrls,
  useDownloadUrl
} from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import { captureDownloadClick } from '../../../scripts/posthog'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en', class: customClass = '' } = defineProps<{
  locale?: Locale
  class?: HTMLAttributes['class']
}>()

const { downloadUrl, platform, showFallback } = useDownloadUrl()

const label = computed(() => t('download.hero.downloadLocal', locale))

const ICONS: Record<Platform, string> = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg'
}

interface ButtonSpec {
  key: Platform
  href: string
  icon: string
  ariaLabel?: string
}

const buttons = computed<ButtonSpec[]>(() => {
  if (platform.value) {
    return [
      {
        key: platform.value,
        href: downloadUrl.value,
        icon: ICONS[platform.value]
      }
    ]
  }
  if (showFallback.value) {
    return [
      {
        key: 'windows',
        href: downloadUrls.windows,
        icon: ICONS.windows,
        ariaLabel: `${label.value} — Windows`
      },
      {
        key: 'mac',
        href: downloadUrls.macArm,
        icon: ICONS.mac,
        ariaLabel: `${label.value} — macOS`
      }
    ]
  }
  return []
})
</script>

<template>
  <BrandButton
    v-for="btn in buttons"
    :key="btn.key"
    :href="btn.href"
    target="_blank"
    size="lg"
    :class="customClass"
    :aria-label="btn.ariaLabel"
    :data-astro-prefetch="btn.key === 'windows' ? 'false' : undefined"
    @click="captureDownloadClick(btn.key)"
  >
    <span class="inline-flex items-center gap-2">
      <img :src="btn.icon" alt="" class="size-5 -translate-y-0.75" />
      {{ label }}
    </span>
  </BrandButton>
</template>
