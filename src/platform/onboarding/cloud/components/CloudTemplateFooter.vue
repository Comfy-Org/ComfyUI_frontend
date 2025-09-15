<template>
  <footer class="flex gap-2.5 w-5/6 h-[5%] max-h-[60px] mx-auto items-start">
    <a
      href="https://www.comfy.org/terms-of-service"
      target="_blank"
      class="text-sm text-gray-600 no-underline cursor-pointer"
    >
      {{ t('auth.login.termsLink') }}
    </a>
    <a
      href="https://www.comfy.org/privacy-policy"
      target="_blank"
      class="text-sm text-gray-600 no-underline cursor-pointer"
    >
      {{ t('auth.login.privacyLink') }}
    </a>
    <a
      href="https://support.comfy.org"
      class="text-sm text-gray-600 no-underline cursor-pointer"
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
