<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center gap-2 border-b border-border-default p-4"
    >
      <p class="m-0 min-w-0 flex-1 font-inter text-sm text-base-foreground">
        {{ $t(titleKey) }}
      </p>
      <button
        type="button"
        :aria-label="$t('g.close')"
        class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-base-foreground hover:text-muted-foreground"
        @click="onClose"
      >
        <i class="pi pi-times text-xs" />
      </button>
    </div>

    <div class="p-4">
      <p class="m-0 font-inter text-sm text-muted-foreground">
        {{ $t(descriptionKey) }}
      </p>
    </div>

    <div class="flex items-center justify-end p-4">
      <Button
        :variant="canManage ? 'inverted' : 'secondary'"
        size="lg"
        :disabled="canManage && isUpdatingPayment"
        @click="canManage ? onUpdatePayment() : onClose()"
      >
        <i
          v-if="canManage && isUpdatingPayment"
          class="pi pi-spin pi-spinner"
        />
        {{
          $t(
            canManage
              ? 'subscription.paymentRecovery.ownerCta'
              : 'subscription.paymentRecovery.memberCta'
          )
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'

const {
  canManage,
  status,
  isUpdatingPayment = false,
  onClose,
  onUpdatePayment
} = defineProps<{
  canManage: boolean
  status: 'paused' | 'payment_failed'
  isUpdatingPayment?: boolean
  onClose: () => void
  onUpdatePayment: () => void
}>()

const titleKey = computed(() =>
  status === 'payment_failed'
    ? canManage
      ? 'subscription.paymentRecovery.paymentFailedOwnerTitle'
      : 'subscription.paymentRecovery.paymentFailedMemberTitle'
    : 'subscription.paymentRecovery.title'
)

const descriptionKey = computed(() =>
  canManage
    ? status === 'payment_failed'
      ? 'subscription.paymentRecovery.paymentFailedOwnerDescription'
      : 'subscription.paymentRecovery.ownerDescription'
    : status === 'payment_failed'
      ? 'subscription.paymentRecovery.paymentFailedMemberDescription'
      : 'subscription.paymentRecovery.memberDescription'
)
</script>
