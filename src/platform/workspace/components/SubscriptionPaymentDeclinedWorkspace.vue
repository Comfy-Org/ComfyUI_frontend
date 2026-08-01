<template>
  <div
    class="mx-auto flex size-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col gap-6">
      <div class="flex items-center">
        <button
          class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
          :aria-label="$t('g.back')"
          @click="$emit('back')"
        >
          <i class="icon-[lucide--arrow-left] size-5" />
        </button>
      </div>
      <div class="flex flex-col items-center gap-3 text-center">
        <i
          class="icon-[lucide--circle-alert] size-10 text-warning-background"
        />
        <h2
          class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
        >
          {{ $t('subscription.preview.paymentDeclinedTitle') }}
        </h2>
        <p class="m-0 text-sm text-balance text-muted-foreground">
          {{ $t('subscription.preview.paymentDeclinedDescription') }}
        </p>
      </div>
      <div
        v-if="reason"
        class="flex flex-col gap-1 rounded-lg bg-secondary-background p-4"
      >
        <span class="text-xs text-muted-foreground">
          {{ $t('subscription.preview.stripeReasoning') }}
        </span>
        <span class="text-sm text-base-foreground">
          {{ reason }}
        </span>
      </div>
    </div>
    <div class="flex flex-col pt-8 pb-4">
      <Button
        variant="secondary"
        size="lg"
        class="h-10 justify-center rounded-lg"
        @click="$emit('updatePayment')"
      >
        {{ $t('subscription.preview.updatePaymentMethod') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { reason = null } = defineProps<{
  reason?: string | null
}>()

defineEmits<{
  back: []
  updatePayment: []
}>()
</script>
