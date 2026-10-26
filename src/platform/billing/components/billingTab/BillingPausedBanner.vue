<template>
  <div
    v-if="isPaused"
    role="status"
    class="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-3 sm:flex-row sm:items-center sm:gap-2"
    data-testid="billing-paused-banner"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-2">
      <div class="flex items-center gap-2">
        <i
          :class="
            cn(
              'size-4 shrink-0',
              paused.muted
                ? 'icon-[lucide--circle-alert] text-muted-foreground'
                : 'icon-[lucide--triangle-alert] text-warning'
            )
          "
        />
        <span class="text-sm text-foreground">{{ $t(paused.titleKey) }}</span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">
        {{ $t(paused.bodyKey) }}
      </p>
    </div>
    <Button
      v-if="paused.action === 'updatePayment'"
      variant="inverted"
      size="md"
      class="shrink-0"
      :loading="isUpdatingPayment"
      @click="updatePayment"
    >
      {{ $t('workspacePanel.billingStatus.updatePayment') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'
import {
  pausedBannerCopy,
  usePausedBanner
} from '@/platform/billing/composables/usePausedBanner'
import { usePaymentRecoveryDialog } from '@/platform/billing/composables/usePaymentRecoveryDialog'

const { canManageBilling } = defineProps<{
  canManageBilling: boolean
}>()

const { isPaused } = usePausedBanner()
const paused = computed(() => pausedBannerCopy(canManageBilling))
const { updatePayment, isUpdatingPayment } = usePaymentRecoveryDialog()
</script>
