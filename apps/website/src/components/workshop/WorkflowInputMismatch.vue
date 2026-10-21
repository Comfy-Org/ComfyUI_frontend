<script setup lang="ts">
import type { WorkflowCatalogDetails } from '@/config/workflow-catalog-details'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const { mismatch, locale = 'en' } = defineProps<{
  mismatch: NonNullable<WorkflowCatalogDetails['inputMismatch']>
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <!-- The page still renders when the input settings and input schema
  disagree; this note names the inputs instead of failing the page. -->
  <div
    role="note"
    class="mb-6 rounded-2xl border border-primary-comfy-orange/40 bg-primary-comfy-orange/10 p-4 text-sm text-primary-warm-white"
    data-testid="workflow-input-mismatch"
  >
    <p class="mb-2 font-bold">{{ t('cccWorkflow.inputMismatchTitle') }}</p>
    <p>{{ t('cccWorkflow.inputMismatch') }}</p>
    <p v-if="mismatch.undeclared.length" class="mt-2 wrap-break-word">
      {{
        t('cccWorkflow.inputUndeclared', {
          names: mismatch.undeclared.join(', ')
        })
      }}
    </p>
    <p v-if="mismatch.unconfigured.length" class="mt-2 wrap-break-word">
      {{
        t('cccWorkflow.inputUnconfigured', {
          names: mismatch.unconfigured.join(', ')
        })
      }}
    </p>
  </div>
</template>
