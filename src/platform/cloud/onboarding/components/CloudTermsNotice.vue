<template>
  <div
    class="mt-10 mb-8 shrink-0 text-center text-sm/relaxed text-primary-warm-gray"
  >
    <p class="my-0">
      {{ t('auth.login.termsText') }}
      <br />
      <a
        href="https://www.comfy.org/terms-of-service"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('auth.login.termsLink') }}
      </a>
      {{ t('auth.login.andText') }}
      <a
        href="https://www.comfy.org/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-comfy-canvas underline"
      >
        {{ t('auth.login.privacyLink') }} </a
      >.
    </p>
    <p class="mt-4 mb-0 text-xs/relaxed">
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

const { t } = useI18n()
</script>
