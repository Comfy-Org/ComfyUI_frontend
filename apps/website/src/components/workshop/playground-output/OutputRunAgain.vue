<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  message,
  hint,
  retryDisabled = false,
  locale = 'en'
} = defineProps<{
  message: string
  hint?: string
  retryDisabled?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
  >
    <p class="text-sm text-primary-comfy-canvas">
      {{ message }}
    </p>
    <p v-if="hint" class="max-w-sm text-xs text-primary-warm-gray">
      {{ hint }}
    </p>
    <Button
      variant="outline"
      size="sm"
      :disabled="retryDisabled"
      @click="$emit('retry')"
    >
      {{ t('workshop.output.runAgain') }}
    </Button>
  </div>
</template>
