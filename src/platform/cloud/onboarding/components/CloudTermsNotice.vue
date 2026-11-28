<template>
  <div
    class="mt-10 shrink-0 text-center text-sm/relaxed text-primary-warm-gray"
  >
    <p class="my-0">
      {{ t('auth.login.termsText') }}
      <br />
      <a
        :href="termsUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('auth.login.termsLink') }}
      </a>
      {{ t('auth.login.andText') }}
      <a
        :href="privacyUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('auth.login.privacyLink') }} </a
      >.
    </p>
    <p class="my-4 text-xs/relaxed">
      {{ t('cloudWaitlist_questionsText') }}
      <a
        href="https://support.comfy.org"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('cloudWaitlist_contactLink') }} </a
      >.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { productLink } from '@/platform/links/productLink'

const termsUrl = productLink(
  'https://comfy.org/terms-of-service/',
  'cloud_onboarding_terms'
)
const privacyUrl = productLink(
  'https://comfy.org/privacy-policy/',
  'cloud_onboarding_terms'
)

const { t } = useI18n()
</script>
