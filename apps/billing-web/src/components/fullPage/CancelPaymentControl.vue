<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { CancelOffer } from '@/checkout/checkoutPage'

const { offer } = defineProps<{ offer: CancelOffer }>()

const emit = defineEmits<{ cancel: [] }>()

const { t } = useI18n()
</script>

<template>
  <p
    v-if="offer === 'not_cancelable'"
    class="m-0 text-center text-xs/4 text-muted-foreground"
  >
    {{ t('checkout.fullPage.phase.notCancelable') }}
  </p>
  <button
    v-else
    type="button"
    :disabled="offer === 'canceling'"
    :aria-busy="offer === 'canceling'"
    class="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-tertiary-background px-4 text-sm font-semibold text-base-foreground hover:bg-tertiary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    @click="emit('cancel')"
  >
    <template v-if="offer === 'canceling'">
      <i
        class="icon-[lucide--loader-circle] size-4 motion-safe:animate-spin"
        aria-hidden="true"
      />
      {{ t('checkout.fullPage.phase.canceling') }}
    </template>
    <template v-else>{{ t('checkout.fullPage.phase.cancel') }}</template>
  </button>
</template>
