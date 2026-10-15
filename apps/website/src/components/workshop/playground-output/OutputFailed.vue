<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import type { RunFailure } from '@/config/workshop-run'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  reason,
  message,
  memberWorkspace,
  hasUnreadableFile = false,
  retryDisabled = false,
  locale = 'en'
} = defineProps<{
  reason: RunFailure
  message: string
  memberWorkspace?: string
  hasUnreadableFile?: boolean
  retryDisabled?: boolean
  locale?: Locale
}>()
const { t } = translationsFor(locale)

defineEmits<{ retry: []; switchPersonal: []; buyCredits: [] }>()

const action = computed(() => {
  if (reason === 'noCredits')
    return memberWorkspace === undefined ? 'buyCredits' : 'switchPersonal'
  if (hasUnreadableFile || reason === 'validation' || reason === 'policy')
    return undefined
  return 'retry'
})
</script>

<template>
  <div
    class="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    data-testid="run-error"
    :data-reason="reason"
  >
    <p class="text-sm text-primary-comfy-red">
      {{ message }}
    </p>
    <Button
      v-if="action === 'switchPersonal'"
      variant="outline"
      size="sm"
      @click="$emit('switchPersonal')"
    >
      {{ t('workshop.run.switchPersonal') }}
    </Button>
    <Button
      v-else-if="action === 'buyCredits'"
      variant="outline"
      size="sm"
      @click="$emit('buyCredits')"
    >
      {{ t('nav.buyCredits') }}
    </Button>
    <Button
      v-else-if="action === 'retry'"
      variant="outline"
      size="sm"
      :disabled="retryDisabled"
      @click="$emit('retry')"
    >
      {{ t('workshop.error.retry') }}
    </Button>
  </div>
</template>
