<template>
  <div
    v-if="banner"
    role="status"
    class="flex items-center gap-2 rounded-2xl border border-interface-stroke/60 bg-base-background p-4"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex items-center gap-2">
        <i
          :class="
            cn(
              'size-4 shrink-0',
              // Triangle + amber for problems that need action (out of credits,
              // payment failed); circle + muted for informational status notices
              // (paused).
              banner.kind === 'paused'
                ? 'icon-[lucide--circle-alert] text-muted-foreground'
                : 'icon-[lucide--triangle-alert] text-warning-background'
            )
          "
        />
        <span class="text-sm text-base-foreground">{{ banner.title }}</span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">{{ banner.body }}</p>
    </div>
    <div v-if="banner.showAction" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
      <template v-if="banner.kind === 'outOfCredits'">
        <Button variant="textonly" size="lg" @click="dismiss">
          {{ $t('workspacePanel.billingStatus.outOfCredits.dismiss') }}
        </Button>
        <Button variant="secondary" size="lg" @click="handleAddCredits">
          {{ $t('workspacePanel.billingStatus.outOfCredits.addCredits') }}
        </Button>
      </template>
      <Button v-else variant="inverted" size="lg">
        {{ $t('workspacePanel.billingStatus.updatePayment') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { t, d } = useI18n()
const {
  billingStatus,
  isPaused,
  isActiveSubscription,
  subscription,
  renewalDate
} = useBillingContext()
const { permissions, isInPersonalWorkspace } = useWorkspaceUI()
const dialogService = useDialogService()

const canManage = computed(() => permissions.value.canManageSubscription)

const cycleResetDate = computed(() => {
  const raw = renewalDate.value
  return raw ? d(new Date(raw), { month: 'short', day: 'numeric' }) : ''
})

// Out of credits: an active, non-paused team that has exhausted its balance.
// Paused takes over this slot (see priority below). Dismissible for the session.
const dismissed = ref(false)
const isOutOfCredits = computed(
  () =>
    isActiveSubscription.value &&
    !isPaused.value &&
    subscription.value?.hasFunds === false
)

// One status banner slot across every workspace tab, in priority order: paused →
// payment-failure warning → out of credits. All owner/admin-only (members can't
// act on any of them).
const banner = computed(() => {
  if (isInPersonalWorkspace.value) return null

  if (isPaused.value) {
    return {
      kind: 'paused' as const,
      title: t('workspacePanel.billingStatus.paused.title'),
      body: canManage.value
        ? t('workspacePanel.billingStatus.paused.body')
        : t('workspacePanel.billingStatus.paused.memberBody'),
      showAction: canManage.value
    }
  }

  if (billingStatus.value === 'payment_failed' && canManage.value) {
    return {
      kind: 'warning' as const,
      title: t('workspacePanel.billingStatus.warning.title'),
      body: t('workspacePanel.billingStatus.warning.body', {
        date: cycleResetDate.value
      }),
      showAction: true
    }
  }

  if (isOutOfCredits.value && canManage.value && !dismissed.value) {
    return {
      kind: 'outOfCredits' as const,
      title: t('workspacePanel.billingStatus.outOfCredits.title'),
      body: cycleResetDate.value
        ? t('workspacePanel.billingStatus.outOfCredits.body', {
            date: cycleResetDate.value
          })
        : t('workspacePanel.billingStatus.outOfCredits.bodyNoDate'),
      showAction: true
    }
  }

  return null
})

function dismiss() {
  dismissed.value = true
}

function handleAddCredits() {
  void dialogService.showTopUpCreditsDialog()
}
</script>
