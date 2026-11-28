<template>
  <footer
    class="mt-10 flex w-full shrink-0 items-start justify-center gap-2.5 text-sm"
  >
    <a
      :href="termsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="cursor-pointer text-primary-comfy-canvas/60 no-underline"
    >
      {{ t('auth.login.termsLink') }}
    </a>
    <a
      :href="privacyUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="cursor-pointer text-primary-comfy-canvas/60 no-underline"
    >
      {{ t('auth.login.privacyLink') }}
    </a>
    <a
      href="https://support.comfy.org"
      class="cursor-pointer text-primary-comfy-canvas/60 no-underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t('cloudFooter_needHelp') }}
    </a>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { productLink } from '@/platform/links/productLink'

const termsUrl = productLink(
  'https://comfy.org/terms-of-service/',
  'cloud_onboarding_footer'
)
const privacyUrl = productLink(
  'https://comfy.org/privacy-policy/',
  'cloud_onboarding_footer'
)

const { t } = useI18n()
</script>
