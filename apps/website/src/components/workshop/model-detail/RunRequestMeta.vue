<script setup lang="ts">
import CopyTextButton from '@/components/ui/copy-text-button/CopyTextButton.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  showsExpiry,
  requestId,
  locale = 'en'
} = defineProps<{
  showsExpiry: boolean
  requestId: string | null
  locale?: Locale
}>()
const { t } = translationsFor(locale)
</script>

<template>
  <div class="flex flex-col gap-1">
    <p
      v-if="showsExpiry"
      class="text-xs text-primary-warm-gray"
      data-testid="output-expires"
    >
      {{ t('workshop.output.expires') }}
    </p>
    <!-- The id is for the rare conversation with support, so it keeps
    to itself and the copy comes to hand when the reader reaches for
    it. A screen that cannot hover keeps the button in view. -->
    <div v-if="requestId" class="group/request flex items-center gap-1">
      <p
        class="text-2xs break-all text-primary-warm-gray/70"
        data-testid="router-request-id"
      >
        {{ t('workshop.run.requestId') }} {{ requestId }}
      </p>
      <CopyTextButton
        :value="requestId"
        :label="t('workshop.run.copyRequestId')"
        :copied-label="t('workshop.api.copied')"
        icon-class="size-3.5"
        class="h-7 min-w-7 rounded-lg px-1.5 transition-opacity can-hover:opacity-0 can-hover:group-focus-within/request:opacity-100 can-hover:group-hover/request:opacity-100"
      />
    </div>
  </div>
</template>
