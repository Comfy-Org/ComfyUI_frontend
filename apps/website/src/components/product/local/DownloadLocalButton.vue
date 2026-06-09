<script setup lang="ts">
import type { Locale } from '../../../i18n/translations'
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import {
  downloadUrls,
  useDownloadUrl
} from '../../../composables/useDownloadUrl'
import { t } from '../../../i18n/translations'
import BrandButton from '../../common/BrandButton.vue'

const { locale = 'en', class: customClass = '' } = defineProps<{
  locale?: Locale
  class?: HTMLAttributes['class']
}>()

const { downloadUrl, platform, detected } = useDownloadUrl()

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
  <!-- UA detection found a matching OS — single CTA, current behavior. -->
  <BrandButton
    v-if="detected && platform"
    :href="downloadUrl"
    target="_blank"
    size="lg"
    :class="customClass"
  >
    <span class="inline-flex items-center gap-2">
      <img
        v-if="iconSrc"
        :src="iconSrc"
        alt=""
        class="ppformula-text-center size-5 -translate-y-0.75"
        aria-hidden="true"
      />
      <span class="ppformula-text-center">{{
        t('download.hero.downloadLocal', locale)
      }}</span>
    </span>
  </BrandButton>

  <!-- UA detection ran but couldn't pick a platform (mobile, Linux, stripped
       UA) — fall back to surfacing both Windows and Mac builds so the user
       isn't stranded with nothing to click. Rendered as a fragment of two
       siblings so they slot directly into the parent's flex container next
       to the existing GitHub install button. -->
  <template v-else-if="detected">
    <BrandButton
      :href="downloadUrls.windows"
      target="_blank"
      size="lg"
      :class="customClass"
      :aria-label="`${t('download.hero.downloadLocal', locale)} — Windows`"
    >
      <span class="inline-flex items-center gap-2">
        <img
          src="/icons/os/windows.svg"
          alt=""
          class="ppformula-text-center size-5 -translate-y-0.75"
          aria-hidden="true"
        />
        <span class="ppformula-text-center">Windows</span>
      </span>
    </BrandButton>
    <BrandButton
      :href="downloadUrls.macArm"
      target="_blank"
      size="lg"
      :class="customClass"
      :aria-label="`${t('download.hero.downloadLocal', locale)} — macOS`"
    >
      <span class="inline-flex items-center gap-2">
        <img
          src="/icons/os/apple.svg"
          alt=""
          class="ppformula-text-center size-5 -translate-y-0.75"
          aria-hidden="true"
        />
        <span class="ppformula-text-center">macOS</span>
      </span>
    </BrandButton>
  </template>
</template>
