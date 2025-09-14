<template>
  <BaseViewTemplate dark>
    <div class="flex flex-col items-center justify-center min-h-screen p-8">
      <div class="w-full max-w-md text-center">
        <h1 class="text-3xl font-bold mb-8">
          {{ t('cloudOnboarding.waitlist.title') }}
        </h1>
        <div class="space-y-6">
          <p class="text-gray-400">
            {{ t('cloudOnboarding.waitlist.message') }}
          </p>
        </div>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
</script>
