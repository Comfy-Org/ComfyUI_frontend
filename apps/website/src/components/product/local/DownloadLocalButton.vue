<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import type { Platform } from '../../../composables/useDownloadUrl'
import {
  downloadUrl,
  useDownloadUrl
} from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import { captureDownloadClick } from '../../../scripts/posthog'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en', class: customClass = '' } = defineProps<{
  locale?: Locale
  class?: HTMLAttributes['class']
}>()

const { platform, showDownload } = useDownloadUrl()

const label = computed(() => t('download.hero.downloadLocal', locale))

const ICONS: Record<Platform, string> = {
  windows: '/icons/os/windows.svg',
  mac: '/icons/os/apple.svg',
  linux: '/icons/os/linux.svg'
}

const icon = computed(() => (platform.value ? ICONS[platform.value] : null))
</script>

<template>
  <BrandButton
    v-if="showDownload"
    :href="downloadUrl"
    target="_blank"
    size="lg"
    :class="customClass"
    @click="captureDownloadClick(platform ?? 'any')"
  >
    <span class="inline-flex items-center gap-2">
      <img v-if="icon" :src="icon" alt="" class="inline-block size-5" />
      <span class="inline-block">{{ label }}</span>
    </span>
  </BrandButton>
</template>
