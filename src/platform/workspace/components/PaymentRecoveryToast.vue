<script lang="ts">
export interface PaymentRecoveryToastProps {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}
</script>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import ToastDescription from '@/components/ui/toast/ToastDescription.vue'
import ToastTitle from '@/components/ui/toast/ToastTitle.vue'

defineProps<PaymentRecoveryToastProps>()
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center justify-between gap-2">
    <div class="flex min-w-0 flex-col justify-start">
      <ToastTitle>{{ title }}</ToastTitle>
      <ToastDescription class="mt-1 text-base-foreground">
        {{ description }}
      </ToastDescription>
    </div>
    <Button size="md" variant="inverted" @click="onAction">
      {{ actionLabel }}
    </Button>
  </div>
</template>
