<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

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
    :class="
      cn(
        buttonVariants({ variant: 'tertiary', size: 'lg' }),
        'w-full font-semibold'
      )
    "
    @click="emit('cancel')"
  >
    <template v-if="offer === 'canceling'">
      <i
        class="icon-[lucide--loader-circle] motion-safe:animate-spin"
        aria-hidden="true"
      />
      {{ t('checkout.fullPage.phase.canceling') }}
    </template>
    <template v-else>{{ t('checkout.fullPage.phase.cancel') }}</template>
  </button>
</template>
