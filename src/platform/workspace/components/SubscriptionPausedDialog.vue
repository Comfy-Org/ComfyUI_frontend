<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center gap-2 border-b border-border-default p-4"
    >
      <p class="m-0 min-w-0 flex-1 font-inter text-sm text-base-foreground">
        {{ $t('subscription.paymentRecovery.title') }}
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
        {{
          $t(
            canManage
              ? 'subscription.paymentRecovery.ownerDescription'
              : 'subscription.paymentRecovery.memberDescription'
          )
        }}
      </p>
    </div>

    <div class="flex items-center justify-end p-4">
      <Button
        :variant="canManage ? 'subscribe' : 'secondary'"
        size="lg"
        :loading="canManage && isUpdatingPayment"
        :disabled="canManage && isUpdatingPayment"
        :aria-label="
          $t(
            canManage
              ? 'subscription.paymentRecovery.ownerCta'
              : 'subscription.paymentRecovery.memberCta'
          )
        "
        @click="canManage ? onUpdatePayment() : onClose()"
      >
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
import Button from '@/components/ui/button/Button.vue'

const {
  canManage,
  isUpdatingPayment = false,
  onClose,
  onUpdatePayment
} = defineProps<{
  canManage: boolean
  isUpdatingPayment?: boolean
  onClose: () => void
  onUpdatePayment: () => void
}>()
</script>
