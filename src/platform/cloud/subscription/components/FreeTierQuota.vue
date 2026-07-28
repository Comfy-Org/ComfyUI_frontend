<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useFreeTierQuota } from '@/platform/cloud/subscription/composables/useFreeTierQuota'

const DOT_COLORS = [
  'bg-destructive-background',
  'bg-warning-background',
  'bg-success-background'
]

const { isFreeTier, showSubscriptionDialog } = useBillingContext()
const { t } = useI18n()
const { available, hasInvalidNodes, maxAvailable, quotaEnabled } =
  useFreeTierQuota()

const dotColor = computed(() => {
  const ratio = maxAvailable.value ? available.value / maxAvailable.value : 0
  return DOT_COLORS[
    Math.min(Math.floor(ratio * DOT_COLORS.length), DOT_COLORS.length - 1)
  ]
})
const label = computed(() =>
  available.value === 0
    ? t('actionbar.freeTierRunsExhausted')
    : t('actionbar.freeTierRuns', {
        available: available.value,
        MAX_AVAILABLE: maxAvailable.value
      })
)
</script>
<template>
  <div
    v-if="quotaEnabled && isFreeTier"
    class="mt-2 w-full cursor-pointer border-t border-border-subtle bg-comfy-menu-bg px-4 pt-2 select-none"
    data-testid="free-tier-quota"
    @click="showSubscriptionDialog({ reason: 'free_tier_quota' })"
  >
    <div
      v-if="hasInvalidNodes"
      class="flex w-full items-center justify-center gap-2"
    >
      <i class="icon-[comfy--credits] bg-credit" />
      {{ t('actionbar.freeTierPartner') }}
    </div>
    <div v-else class="flex w-full items-center justify-between">
      <div class="flex gap-2" :aria-label="label" role="img">
        <div
          v-for="index in maxAvailable"
          :key="index"
          :class="
            cn(
              'size-1.5 rounded-full',
              index > available ? 'bg-secondary-background-selected' : dotColor
            )
          "
        />
      </div>
      <div v-text="label" />
    </div>
  </div>
</template>
