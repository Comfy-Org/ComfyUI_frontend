<template>
  <div
    class="flex flex-1 flex-col items-start gap-3 rounded-2xl border border-interface-stroke p-6"
  >
    <div class="flex items-center gap-2 text-text-secondary" role="alert">
      <i
        :class="
          cn(
            'pi',
            isError ? 'pi-exclamation-circle text-danger' : 'pi-info-circle'
          )
        "
        aria-hidden="true"
      />
      <span class="text-sm">{{ message }}</span>
    </div>
    <Button
      v-if="isError"
      variant="secondary"
      size="lg"
      class="rounded-lg px-4 text-sm font-normal"
      @click="emit('retry')"
    >
      {{ t('subscription.planLoadErrorRetry') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

// `error`: the load failed — show the failure message and a retry.
// `empty`: the catalog loaded successfully with no plans — inform, no retry.
const { variant = 'error' } = defineProps<{
  variant?: 'empty' | 'error'
}>()

const emit = defineEmits<{ retry: [] }>()
const { t } = useI18n()

const isError = computed(() => variant === 'error')
const message = computed(() =>
  isError.value
    ? t('subscription.planLoadError')
    : t('settingsPlans.noPlansAvailable')
)
</script>
