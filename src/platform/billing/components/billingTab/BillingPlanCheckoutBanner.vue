<template>
  <div
    v-if="banner"
    role="status"
    class="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:gap-2"
    data-testid="billing-plan-checkout-banner"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i
          :class="
            cn(
              'size-4 shrink-0',
              banner.kind === 'verifyPayment'
                ? 'icon-[lucide--triangle-alert] text-warning'
                : 'icon-[lucide--circle-alert] text-muted-foreground'
            )
          "
          aria-hidden="true"
        />
        <span class="text-sm text-foreground">{{ copy?.title }}</span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">{{ copy?.body }}</p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-2 pl-6 sm:pl-0">
      <Button variant="textonly" size="md" @click="emit('dismiss')">
        {{ $t('workspacePanel.billingStatus.planCheckout.dismiss') }}
      </Button>
      <Button
        v-if="banner.kind === 'verifyPayment' && banner.actionUrl"
        as="a"
        :href="banner.actionUrl"
        target="_blank"
        rel="noopener"
        variant="secondary"
        size="md"
        class="no-underline"
      >
        {{
          $t('workspacePanel.billingStatus.planCheckout.verifyPayment.action')
        }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { PlanCheckoutBanner } from '@/platform/billing/components/billingTab/planCheckoutBanner'

const { banner } = defineProps<{
  banner: PlanCheckoutBanner | null
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const { t } = useI18n()

const copy = computed(() => {
  if (!banner) return null
  const key =
    banner.kind === 'verifyPayment' ? 'verifyPayment' : 'paymentReceived'
  const prefix = `workspacePanel.billingStatus.planCheckout.${key}`
  return {
    title: t(`${prefix}.title`),
    body: t(`${prefix}.body`)
  }
})
</script>
