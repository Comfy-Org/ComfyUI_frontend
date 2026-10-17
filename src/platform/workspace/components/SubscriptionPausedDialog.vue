<template>
  <DialogPanel class="w-90 max-w-full" @close="onClose">
    <template #title>
      {{ $t(titleKey) }}
    </template>

    <div class="p-4">
      <p class="m-0 font-inter text-sm text-muted-foreground">
        {{ $t(descriptionKey) }}
      </p>
    </div>

    <template #footer>
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
    </template>
  </DialogPanel>
</template>

<script setup lang="ts">
import DialogPanel from '@/components/ui/dialog/DialogPanel.vue'
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
