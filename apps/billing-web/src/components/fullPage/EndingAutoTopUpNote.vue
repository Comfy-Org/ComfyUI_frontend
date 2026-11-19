<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

const { activation } = defineProps<{
  activation?: 'pending' | 'failed'
}>()

const emit = defineEmits<{
  openBilling: []
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="activation" class="flex flex-col items-center gap-2">
    <p
      class="m-0 text-sm/5 text-muted-foreground"
      data-testid="checkout-ending-auto-top-up"
    >
      {{ t(`checkout.fullPage.ending.autoTopUp.${activation}`) }}
    </p>
    <button
      v-if="activation === 'failed'"
      type="button"
      :class="
        cn(buttonVariants({ variant: 'textonly', size: 'lg' }), 'font-semibold')
      "
      @click="emit('openBilling')"
    >
      {{ t('checkout.fullPage.ending.autoTopUp.openBilling') }}
    </button>
  </div>
</template>
