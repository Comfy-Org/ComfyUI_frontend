<script setup lang="ts">
import { Download, ExternalLink } from '@lucide/vue'

import Button from '@/components/ui/button/Button.vue'
import type { RunOutput } from '@/config/workshop-run'
import type { Locale, TranslationKey } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  shown,
  url,
  blurred,
  needsLink,
  downloadLabel,
  locale = 'en'
} = defineProps<{
  shown: RunOutput
  url: string
  blurred: boolean
  needsLink: boolean
  downloadLabel: TranslationKey
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ useInCode: []; download: [event: MouseEvent] }>()
</script>

<template>
  <div
    class="flex flex-col gap-2 border-t border-transparency-white-t8 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
  >
    <p
      v-if="needsLink && !blurred"
      role="status"
      class="w-full text-xs text-primary-warm-gray"
    >
      {{ t('workshop.output.downloadFallback') }}
    </p>
    <Button
      variant="outline"
      size="sm"
      class="w-full sm:w-auto"
      data-testid="output-use-in-code"
      @click="$emit('useInCode')"
    >
      {{ t('workshop.output.useInCode') }}
    </Button>
    <Button
      v-if="url && !blurred"
      as="a"
      :href="shown.download?.url ?? url"
      :download="needsLink || shown.download ? undefined : shown.fileName"
      :prepend-icon="needsLink ? ExternalLink : Download"
      target="_blank"
      rel="noopener"
      size="sm"
      class="w-full sm:w-auto"
      data-testid="output-download"
      @click="$emit('download', $event)"
    >
      {{ t(downloadLabel) }}
    </Button>
  </div>
</template>
