<script setup lang="ts">
import type { Locale } from '@/i18n/translations'
import { computed } from 'vue'
import { translationsFor } from '@/i18n/translations'
const { hasMedia, locale } = defineProps<{
  hasMedia: boolean
  locale: Locale
}>()
const t = computed(() => translationsFor(locale).t)
</script>
<template>
  <details
    class="rounded-2xl border border-transparency-white-t8 px-5"
    data-testid="workflow-api-steps"
  >
    <summary
      class="cursor-pointer list-none py-4 text-sm font-medium text-primary-comfy-canvas marker:hidden hover:text-primary-warm-white"
    >
      {{ t('workshop.workflow.apiSteps') }}
    </summary>
    <div class="space-y-2 pb-5 text-sm/relaxed text-primary-warm-gray">
      <template v-if="hasMedia">
        <h3 class="font-medium text-primary-comfy-canvas">
          {{ t('workshop.workflow.apiUploads') }}
        </h3>
        <ol class="list-decimal space-y-1 ps-5">
          <li>{{ t('workshop.workflow.apiUploadGrant') }}</li>
          <li>{{ t('workshop.workflow.apiUploadPut') }}</li>
          <li>{{ t('workshop.workflow.apiUploadFinalize') }}</li>
        </ol>
      </template>
      <p>{{ t('workshop.workflow.apiPoll') }}</p>
    </div>
  </details>
</template>
