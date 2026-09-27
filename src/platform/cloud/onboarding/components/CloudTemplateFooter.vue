<template>
  <footer class="mt-10 flex w-full shrink-0 items-start justify-center gap-2.5">
    <a
      href="https://comfy.org/terms-of-service/"
      target="_blank"
      rel="noopener noreferrer"
      class="cursor-pointer text-sm text-primary-comfy-canvas/60 no-underline"
    >
      {{ t('auth.login.termsLink') }}
    </a>
    <a
      href="https://comfy.org/privacy-policy/"
      target="_blank"
      rel="noopener noreferrer"
      class="cursor-pointer text-sm text-primary-comfy-canvas/60 no-underline"
    >
      {{ t('auth.login.privacyLink') }}
    </a>
    <a
      href="https://support.comfy.org"
      class="cursor-pointer text-sm text-primary-comfy-canvas/60 no-underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ t('cloudFooter_needHelp') }}
    </a>
  </footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>
