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
        <span
          :class="
            cn(
              'text-2xl leading-none font-bold tabular-nums',
              isLimitReached && 'text-amber-400'
            )
          "
          >{{ displayLabel }}</span
        >
        <span class="text-sm text-muted">{{
          $t('subscription.remaining')
        }}</span>
      </div>
    </div>

    <div
      v-if="showBar && memberCap"
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
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useMemberCreditDisplay } from '@/platform/workspace/composables/useMemberCreditDisplay'

const { locale } = useI18n()
const { subscription } = useBillingContext()
const {
  memberCap,
  displayedNumber,
  isWorkspaceOut,
  isLimitReached,
  isEdgeState
} = useMemberCreditDisplay()

const displayLabel = computed(() =>
  Math.round(displayedNumber.value).toLocaleString(locale.value)
)

const showBar = computed(
  () => !isEdgeState.value && !isWorkspaceOut.value && !isLimitReached.value
)

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
