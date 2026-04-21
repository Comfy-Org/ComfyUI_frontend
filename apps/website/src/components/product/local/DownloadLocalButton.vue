<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { useDownloadUrl } from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en', class: customClass = '' } = defineProps<{
  locale?: Locale
  class?: HTMLAttributes['class']
}>()

const { downloadUrl, platform } = useDownloadUrl()

const iconSrc = computed(() => {
  switch (platform.value) {
    case 'mac':
      return '/icons/os/apple.svg'
    case 'windows':
      return '/icons/os/windows.svg'
    default:
      return undefined
  }
})
</script>

<template>
  <BrandButton
    v-show="platform"
    :href="downloadUrl"
    size="lg"
    :class="customClass"
  >
    <span class="inline-flex items-center gap-2">
      <img
        v-if="iconSrc"
        :src="iconSrc"
        alt=""
        class="ppformula-text-center size-5"
        aria-hidden="true"
      />
      <span class="ppformula-text-center">{{
        t('download.hero.downloadLocal', locale)
      }}</span>
    </span>
  </BrandButton>
</template>
