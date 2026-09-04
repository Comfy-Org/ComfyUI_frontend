<template>
  <div
    class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-base-background"
    data-testid="sales-managed-owner-message"
  >
    <div
      class="flex h-12 items-center gap-2 border-b border-border-default p-4"
    >
      <p class="m-0 min-w-0 flex-1 font-inter text-sm text-base-foreground">
        {{
          outOfCredits
            ? $t('subscription.salesManaged.outOfCreditsTitle')
            : $t('subscription.salesManaged.planTitle')
        }}
      </p>
      <button
        type="button"
        :aria-label="$t('g.close')"
        class="flex size-4 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent text-base-foreground"
        @click="onClose"
      >
        <i class="icon-[lucide--x] size-3" />
      </button>
    </div>

    <div class="p-4">
      <p class="m-0 font-inter text-sm text-muted-foreground">
        {{
          outOfCredits
            ? $t('subscription.salesManaged.outOfCreditsDescription')
            : $t('subscription.salesManaged.planDescription')
        }}
      </p>
    </div>

    <div class="flex items-center justify-end p-4">
      <Button variant="secondary" size="lg" @click="contactSales">
        {{ $t('subscription.salesManaged.contactSales') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

// Same enterprise-discussions URL as the pricing table footer blurb.
const ENTERPRISE_URL = 'https://comfy.org/cloud/enterprise/'

const { onClose, outOfCredits = false } = defineProps<{
  onClose: () => void
  /** Out-of-credits copy instead of the plan-managed copy. */
  outOfCredits?: boolean
}>()

function contactSales() {
  window.open(ENTERPRISE_URL, '_blank', 'noopener,noreferrer')
}
</script>
