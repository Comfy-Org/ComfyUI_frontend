<template>
  <div
    class="@container relative flex flex-col gap-4 rounded-2xl border border-interface-stroke bg-modal-panel-background px-6 py-5"
    data-testid="member-credits-tile"
  >
    <div class="flex flex-col gap-1">
      <div class="text-sm text-muted">
        {{ $t('workspacePanel.memberCredits.tileLabel') }} ·
        {{
          $t('workspacePanel.memberCredits.resetsOn', { date: resetDateLabel })
        }}
      </div>
      <div class="flex items-baseline gap-2">
        <i class="icon-[lucide--coins] size-4 self-center text-credit" />
        <span class="text-2xl leading-none font-bold tabular-nums">{{
          displayLabel
        }}</span>
        <span class="text-sm text-muted">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <div v-if="showBar && memberCap" class="flex flex-col gap-2">
      <div class="flex items-center justify-between text-sm text-muted">
        <span>{{ $t('workspacePanel.memberCredits.monthlyLimitLabel') }}</span>
        <span class="tabular-nums">{{
          $t('workspacePanel.memberCredits.percentUsed', {
            n: Math.round(usagePercent)
          })
        }}</span>
      </div>
      <div
        role="progressbar"
        :aria-valuenow="memberCap.used"
        :aria-valuemin="0"
        :aria-valuemax="memberCap.limit"
        :aria-label="
          $t('workspacePanel.memberCredits.monthlyLimit', {
            n: memberCap.limit.toLocaleString()
          })
        "
        class="h-2 w-full overflow-hidden rounded-full bg-secondary-background-hover"
      >
        <div
          class="h-full rounded-full bg-credit"
          :style="{ width: `${usagePercent}%` }"
        />
      </div>
    </div>

    <div v-if="isEdgeState && memberCap" class="flex flex-col gap-1">
      <p class="m-0 text-sm text-base-foreground">
        {{ $t('workspacePanel.memberCredits.edgeLead') }}
        {{ $t('workspacePanel.memberCredits.edgeExplainer') }}
      </p>
      <p class="m-0 text-sm text-muted-foreground">
        {{
          $t('workspacePanel.memberCredits.monthlyLimit', {
            n: memberCap.limit.toLocaleString()
          })
        }}
      </p>
    </div>

    <!-- tertiary, not secondary: the tile's own surface is secondary-background,
         so a secondary button would be invisible on it (matches CreditsTile). -->
    <Button
      v-if="requestAction"
      variant="tertiary"
      class="w-full"
      :disabled="requestSent"
      data-testid="member-credits-tile-request-button"
      @click="requestSent = true"
    >
      {{
        requestSent
          ? $t('workspacePanel.memberCredits.requested')
          : $t(`workspacePanel.memberCredits.${requestAction}`)
      }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useMemberCreditDisplay } from '@/platform/workspace/composables/useMemberCreditDisplay'

const { locale } = useI18n()
const { subscription } = useBillingContext()
const {
  memberCap,
  displayedNumber,
  isWorkspaceOut,
  isEdgeState,
  requestAction
} = useMemberCreditDisplay()

const requestSent = ref(false)

const displayLabel = computed(() =>
  Math.round(displayedNumber.value).toLocaleString(locale.value)
)

// The bar meters the member's own limit, so it survives limit-reached (full at
// 100%) but hides in the edge state, where the number is the pool's, not theirs.
const showBar = computed(() => !isEdgeState.value && !isWorkspaceOut.value)

const usagePercent = computed(() => {
  const cap = memberCap.value
  if (!cap || cap.limit <= 0) return 0
  return Math.min(100, (cap.used / cap.limit) * 100)
})

const resetDateLabel = computed(() => {
  const iso = subscription.value?.renewalDate
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric'
  })
})
</script>
