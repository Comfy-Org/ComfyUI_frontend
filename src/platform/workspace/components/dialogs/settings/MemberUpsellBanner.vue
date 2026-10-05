<template>
  <div class="@container mb-4">
    <div
      role="status"
      class="flex flex-col gap-3 rounded-2xl border border-interface-stroke/60 bg-base-background p-4 @2xl:flex-row @2xl:items-center @2xl:gap-2"
    >
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex items-center gap-2">
          <i
            class="icon-[lucide--circle-alert] size-4 shrink-0 text-muted-foreground"
          />
          <span v-if="title" class="text-sm text-base-foreground">
            {{ title }}
          </span>
          <span v-else class="text-sm text-muted-foreground">{{ body }}</span>
        </div>
        <p v-if="title" class="m-0 pl-6 text-sm text-muted-foreground">
          {{ body }}
        </p>
      </div>
      <div class="flex shrink-0 flex-wrap items-center gap-2 pl-6 @2xl:pl-0">
        <Button variant="secondary" size="lg" @click="$emit('action')">
          {{ cta }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

// 'upgrade': personal workspace pitching the Team plan (no title — a pitch,
// not a state change). 'reactivate' / 'contactSales': the plan has ended
// (billing_status inactive) and the route back differs by tier — self-serve
// resumes in-product, Enterprise goes through sales (DES-1200).
// `enterprise` discriminates the contactSales copy only: unrecognized tiers
// route to sales too, but must not be named Enterprise (no borrowed claims).
const { variant, enterprise = false } = defineProps<{
  variant: 'upgrade' | 'reactivate' | 'contactSales'
  enterprise?: boolean
}>()

defineEmits<{
  action: []
}>()

const { t } = useI18n()

const title = computed(() => {
  if (variant === 'reactivate')
    return t('workspacePanel.members.endedTeamTitle')
  if (variant === 'contactSales')
    return enterprise
      ? t('workspacePanel.members.endedEnterpriseTitle')
      : t('workspacePanel.members.endedPlanTitle')
  return null
})

const body = computed(() => {
  if (variant === 'reactivate')
    return t('workspacePanel.members.upsellBannerReactivate')
  if (variant === 'contactSales')
    return enterprise
      ? t('workspacePanel.members.upsellBannerEnterpriseEnded')
      : t('workspacePanel.members.upsellBannerPlanEnded')
  return t('workspacePanel.members.upsellBanner')
})

const cta = computed(() => {
  // Not the ending banner's "Resume subscription": an ended plan is past
  // resuming — this CTA starts a new subscription through the pricing table.
  if (variant === 'reactivate') return t('workspacePanel.members.resubscribe')
  if (variant === 'contactSales')
    return t('workspacePanel.members.contactSales')
  return t('workspacePanel.members.upgradeToTeam')
})
</script>
