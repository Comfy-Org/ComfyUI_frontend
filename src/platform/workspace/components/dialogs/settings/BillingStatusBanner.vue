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
              'icon-[lucide--circle-alert] size-4 shrink-0',
              banner.kind === 'warning'
                ? 'text-warning-background'
                : 'text-muted-foreground'
            )
          "
        />
        <span class="text-sm text-base-foreground">{{ banner.title }}</span>
      </div>
      <p class="m-0 pl-6 text-sm text-muted-foreground">{{ banner.body }}</p>
    </div>
    <div v-if="banner.showAction" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
      <Button variant="inverted" size="lg">
        {{ $t('workspacePanel.billingStatus.updatePayment') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { cn } from '@comfyorg/tailwind-utils'

const { t, d } = useI18n()
const { billingStatus, isPaused, renewalDate } = useBillingContext()
const { permissions, isInPersonalWorkspace } = useWorkspaceUI()

const canManage = computed(() => permissions.value.canManageSubscription)

// A payment failure surfaces one banner across every workspace tab. Paused takes
// priority over the grace-period warning; the warning is owner/admin-only since
// members can't act on it (they see nothing until it actually pauses).
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
    const raw = renewalDate.value
    return {
      kind: 'warning' as const,
      title: t('workspacePanel.billingStatus.warning.title'),
      body: t('workspacePanel.billingStatus.warning.body', {
        date: raw ? d(new Date(raw), { month: 'short', day: 'numeric' }) : ''
      }),
      showAction: true
    }
  }

  return null
})
</script>
