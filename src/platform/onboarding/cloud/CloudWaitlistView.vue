<!-- eslint-disable @intlify/vue-i18n/no-raw-text -->
<template>
  <CloudTemplate>
    <div class="flex flex-col items-center justify-center p-8">
      <div class="w-full max-w-md text-center">
        <h1 class="text-3xl italic font-bolder mb-8">
          YOU'RE ON THE<br />
          WAITLIST 🎉
        </h1>
        <div class="max-w-[320px] text-lg font-light">
          <p class="text-white">
            {{ t('cloudOnboarding.waitlist.message') }}
          </p>
          <p class="text-white">
            Questions? Contact us
            <a
              href="https://support.comfy.org"
              class="text-blue-400 no-underline cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
            >
              here</a
            >.
          </p>
        </div>
      </div>
    </div>
  </CloudTemplate>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import CloudTemplate from './components/CloudTemplate.vue'

const { t } = useI18n()
</script>
