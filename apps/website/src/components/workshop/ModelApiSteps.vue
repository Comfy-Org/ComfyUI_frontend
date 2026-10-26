<script setup lang="ts">
import { KeyRound } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import CopyableField from '@/components/ui/copyable-field/CopyableField.vue'
import { MODEL_SDK_INSTALL } from '@/config/models-snippets'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import ApiStep from './ApiStep.vue'

const {
  apiKeyHref,
  endpoint,
  locale = 'en'
} = defineProps<{
  apiKeyHref: string
  endpoint?: string
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const emit = defineEmits<{ getKey: [] }>()
</script>

<template>
  <ol class="flex flex-col gap-6">
    <ApiStep
      :step="1"
      :title="t('hubPages.workflow.getApiKey')"
      :body="t('workshop.workflow.apiStepKeyBody')"
      current
    >
      <Button
        as="a"
        :href="apiKeyHref"
        target="_blank"
        rel="noopener noreferrer"
        variant="secondaryOutline"
        class="px-5"
        data-testid="api-get-key"
        @click="emit('getKey')"
      >
        <template #prepend>
          <KeyRound class="size-4" aria-hidden="true" />
        </template>
        {{ t('hubPages.workflow.getApiKey') }}
        <span class="sr-only">{{ t('workshop.workflow.opensInNewTab') }}</span>
      </Button>
    </ApiStep>
    <ApiStep
      :step="2"
      :title="t('workshop.workflow.apiStepSdk')"
      :body="t('workshop.workflow.apiStepSdkBody')"
    >
      <CopyableField
        :value="MODEL_SDK_INSTALL"
        :copy-label="t('workshop.workflow.apiCopyInstall')"
        :copied-label="t('workshop.api.copied')"
        class="h-10 w-full py-0 lg:w-80"
      />
    </ApiStep>
    <ApiStep
      :step="3"
      :title="t('workshop.workflow.apiStepRun')"
      :body="t('workshop.api.stepRunBody')"
    >
      <CopyableField
        v-if="endpoint"
        :value="endpoint"
        :copy-label="t('workshop.api.copyEndpoint')"
        :copied-label="t('workshop.api.copied')"
        class="h-10 w-full py-0 lg:w-80"
        data-testid="api-endpoint"
      />
    </ApiStep>
  </ol>
</template>
