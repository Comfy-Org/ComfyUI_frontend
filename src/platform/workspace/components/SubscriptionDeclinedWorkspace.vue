<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i class="pi pi-exclamation-circle text-5xl text-warning-background" />
      <h2
        class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
      >
        {{ $t('subscription.declined.title') }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ $t('subscription.declined.body') }}
      </p>

      <!-- Shown only when the API gives a reason: an empty box reads as a
           second failure rather than an explanation. -->
      <div
        v-if="declineReason"
        class="mt-4 flex w-full flex-col gap-1 rounded-xl bg-secondary-background p-4"
      >
        <span class="text-sm text-muted-foreground">
          {{ $t('subscription.declined.reasonLabel') }}
        </span>
        <span class="text-sm text-base-foreground">{{ declineReason }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <Button
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('updatePayment')"
      >
        {{ $t('subscription.declined.updatePaymentMethod') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('back')"
      >
        {{ $t('g.back') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { declineReason = null } = defineProps<{
  /** Stripe's stated reason, when the API provides one. */
  declineReason?: string | null
}>()

defineEmits<{
  /** Collect a different payment method. */
  updatePayment: []
  /** Return to the confirm step with the quote and selection intact. */
  back: []
}>()
</script>
