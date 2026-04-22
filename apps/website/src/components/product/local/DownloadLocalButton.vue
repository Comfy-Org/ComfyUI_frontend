<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'

import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en', className = '' } = defineProps<{
  locale?: Locale
  className?: string
}>()

const { downloadUrl, platform } = useDownloadUrl()
</script>

<template>
  <BrandButton
    v-show="platform"
    :href="downloadUrl"
    size="lg"
    :class-name="`flex items-center justify-center gap-2 ${className}`"
  >
    <span class="inline-flex items-center gap-2">
      <img
        v-if="platform === 'mac'"
        src="/icons/os/apple.svg"
        alt=""
        class="size-5"
        aria-hidden="true"
      />
      <img
        v-else-if="platform === 'windows'"
        src="/icons/os/windows.svg"
        alt=""
        class="size-5"
        aria-hidden="true"
      />
      <span class="translate-y-1">{{
        t('download.hero.downloadLocal', locale)
      }}</span>
    </span>
  </BrandButton>
</template>
