<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

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

const ICONS = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg'
} as const

interface ButtonSpec {
  key: string
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
    const label = t('download.hero.downloadLocal', locale)
    return [
      {
        key: 'windows',
        href: downloadUrls.windows,
        icon: ICONS.windows,
        ariaLabel: `${label} — Windows`
      },
      {
        key: 'mac',
        href: downloadUrls.macArm,
        icon: ICONS.mac,
        ariaLabel: `${label} — macOS`
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
    @click="captureDownloadClick(btn.key)"
  >
    <span class="inline-flex items-center gap-2">
      <img
        :src="btn.icon"
        alt=""
        class="ppformula-text-center size-5 -translate-y-0.75"
        aria-hidden="true"
      />
      <span class="ppformula-text-center">{{
        t('download.hero.downloadLocal', locale)
      }}</span>
    </span>
  </BrandButton>
</template>
