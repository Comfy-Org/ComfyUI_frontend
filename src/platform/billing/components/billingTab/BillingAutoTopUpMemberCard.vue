<template>
  <div
    class="flex flex-col gap-1 rounded-xl border border-card px-5 py-4"
    data-testid="billing-auto-top-up-member-card"
  >
    <h3 class="m-0 flex items-center gap-2 text-sm font-medium text-foreground">
      {{ copy.title }}
      <span
        v-if="view"
        :class="
          cn(
            'flex items-center gap-1 text-xs font-normal',
            view.status === 'failed' || view.status === 'turnedOff'
              ? 'text-destructive'
              : 'text-muted-foreground'
          )
        "
        data-testid="billing-auto-top-up-status"
      >
        <span
          :class="cn('size-1.75 rounded-full', DOT[view.status])"
          aria-hidden="true"
        />
        {{ copy.status[view.status] }}
      </span>
    </h3>
    <p class="m-0 text-sm text-muted-foreground">
      {{ view?.line ?? copy.body }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { autoTopUpMemberView } from '@comfyorg/account-ui/billing'
import type {
  AutoTopUpMemberBlockCopy,
  AutoTopUpStatusLabel
} from '@comfyorg/account-ui/billing'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

const DOT: Record<AutoTopUpStatusLabel, string> = {
  failed: 'bg-destructive',
  turnedOff: 'bg-destructive',
  off: 'bg-muted-foreground',
  onHold: 'bg-warning',
  limitReached: 'bg-warning',
  maximumReached: 'bg-warning',
  on: 'bg-success'
}

const { t, locale } = useI18n()
const { autoTopUpMemberView: served } = useBillingCapabilities()

const copy = computed<AutoTopUpMemberBlockCopy>(() => ({
  title: t('workspacePanel.billingTab.autoTopUp.title'),
  body: t('workspacePanel.billingTab.autoTopUp.member'),
  status: {
    failed: t('workspacePanel.billingTab.autoTopUp.status.failed'),
    turnedOff: t('workspacePanel.billingTab.autoTopUp.status.turnedOff'),
    off: t('workspacePanel.billingTab.autoTopUp.status.off'),
    on: t('workspacePanel.billingTab.autoTopUp.status.on'),
    onHold: t('workspacePanel.billingTab.autoTopUp.status.onHold'),
    limitReached: t('workspacePanel.billingTab.autoTopUp.status.limitReached'),
    maximumReached: t(
      'workspacePanel.billingTab.autoTopUp.status.maximumReached'
    )
  },
  on: (target, threshold) =>
    t('workspacePanel.billingTab.autoTopUp.memberStatus.on', {
      target,
      threshold
    }),
  limitReached: (date) =>
    t('workspacePanel.billingTab.autoTopUp.memberStatus.limitReached', {
      date
    }),
  limitReachedNoDate: t(
    'workspacePanel.billingTab.autoTopUp.memberStatus.limitReachedNoDate'
  ),
  maximumReached: (date) =>
    t('workspacePanel.billingTab.autoTopUp.memberStatus.maximumReached', {
      date
    }),
  maximumReachedNoDate: t(
    'workspacePanel.billingTab.autoTopUp.memberStatus.maximumReachedNoDate'
  ),
  failed: t('workspacePanel.billingTab.autoTopUp.memberStatus.failed'),
  turnedOff: t('workspacePanel.billingTab.autoTopUp.memberStatus.turnedOff'),
  onHold: t('workspacePanel.billingTab.autoTopUp.memberStatus.onHold')
}))

const view = computed(() =>
  autoTopUpMemberView(served.value, copy.value, locale.value)
)
</script>
