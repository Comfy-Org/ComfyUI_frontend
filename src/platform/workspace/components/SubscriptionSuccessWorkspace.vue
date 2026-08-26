<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i class="pi pi-check-circle text-5xl text-success-background" />
      <h2
        class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
      >
        {{ $t('subscription.success.allSet') }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ $t('subscription.success.planUpdated') }}
        {{ $t('subscription.success.receiptEmailed') }}
      </p>

      <!-- Plan summary -->
      <div
        :class="
          cn(
            'mt-4 flex w-full flex-col gap-1 rounded-xl border border-border-default bg-base-background p-4',
            darkSurface && 'border-none bg-secondary-background'
          )
        "
      >
        <span class="text-sm text-base-foreground">{{ tierName }}</span>
        <div class="flex items-baseline gap-1">
          <span
            class="text-2xl font-semibold text-base-foreground tabular-nums"
          >
            ${{ displayPrice }}
          </span>
          <span class="text-sm text-base-foreground">
            {{ priceUnitLabel }}
          </span>
        </div>
        <div class="flex items-center gap-1 text-sm text-muted-foreground">
          <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
          <span class="tabular-nums">
            {{ displayCredits }} {{ creditsUnitLabel }}
          </span>
        </div>
      </div>

      <p
        v-if="promoApplied"
        class="m-0 text-center text-sm text-muted-foreground tabular-nums"
      >
        <span class="font-medium text-base-foreground">
          {{
            $t('subscription.success.promoApplied', { code: promoApplied.code })
          }}
        </span>
        {{
          $t('subscription.success.promoRenews', {
            amount: promoApplied.renewalAmount,
            date: promoApplied.renewalDate
          })
        }}
      </p>

      <div v-if="showInviteBlock" class="mt-4 flex w-full flex-col gap-2">
        <h3 class="m-0 text-base font-normal text-base-foreground">
          {{ $t('subscription.success.inviteTitle') }}
        </h3>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('subscription.success.inviteSubtext') }}
        </p>
        <div aria-live="polite">
          <p
            v-if="invitedEmails.length > 0"
            ref="invitedMessage"
            tabindex="-1"
            class="text-success-foreground m-0 text-sm"
          >
            {{
              $t(
                'workspacePanel.inviteMemberDialog.invitedMessage',
                { emails: invitedEmails.join(', ') },
                invitedEmails.length
              )
            }}
          </p>
          <InviteMembersForm
            v-else
            ref="inviteForm"
            :show-submit="false"
            :tags-input-class="
              darkSurface
                ? 'min-h-10 w-full bg-secondary-background px-3 focus-within:bg-secondary-background hover:bg-secondary-background-hover'
                : undefined
            "
            source="post_upgrade_success"
            :submit-label="$t('subscription.success.sendInvites')"
            :placeholder="$t('subscription.success.inviteEmailsPlaceholder')"
            :max-seats="invitableSeats"
            @submitted="onInvited"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <Button
        v-if="showInviteBlock && invitedEmails.length === 0"
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :disabled="!canSendInvites"
        :loading="isSendingInvites"
        @click="handleSendInvites"
      >
        {{ $t('subscription.success.sendInvites') }}
      </Button>
      <Button
        :variant="
          showInviteBlock && invitedEmails.length === 0
            ? 'muted-textonly'
            : 'secondary'
        "
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('close')"
      >
        {{ $t('g.close') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import Button from '@/components/ui/button/Button.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { isYearlyCheckout } from '@/platform/cloud/subscription/utils/planDuration'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'

import InviteMembersForm from './InviteMembersForm.vue'

const {
  tierKey,
  previewData = null,
  teamPlan = null,
  billingCycle = 'monthly',
  darkSurface = false,
  promoApplied = null
} = defineProps<{
  tierKey?: Exclude<TierKey, 'free' | 'founder'> | null
  previewData?: PreviewSubscribeResponse | null
  teamPlan?: TeamPlanSelection | null
  billingCycle?: BillingCycle
  /** Dialog paints base-background; the plan card elevates to stay visible. */
  darkSurface?: boolean
  /** Applied promotion feedback (Figma 5379-30077 S3). Display-ready strings;
   *  the backend does not supply this yet — see the promo validation ask. */
  promoApplied?: {
    code: string
    renewalAmount: string
    renewalDate: string
  } | null
}>()

defineEmits<{
  close: []
}>()

const { t, n } = useI18n()
const { maxSeats, occupiedSeats } = useBillingContext()

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan?.duration, billingCycle)
)

const displayPrice = computed(() => {
  if (previewData?.new_plan) {
    return (previewData.new_plan.price_cents / 100).toFixed(0)
  }
  if (teamPlan) {
    const usd = isYearly.value
      ? teamPlan.discountedUsd * 12
      : teamPlan.discountedUsd
    return String(usd)
  }
  return '0'
})

const priceUnitLabel = computed(() =>
  isYearly.value ? t('subscription.usdPerYear') : t('subscription.usdPerMonth')
)

const displayCredits = computed(() => {
  const monthlyCredits = teamPlan
    ? teamPlan.credits
    : tierKey
      ? (getTierCredits(tierKey) ?? 0)
      : 0
  return n(isYearly.value ? monthlyCredits * 12 : monthlyCredits)
})

const creditsUnitLabel = computed(() =>
  isYearly.value ? t('subscription.perYear') : t('subscription.perMonth')
)

const invitableSeats = computed(() => {
  if (maxSeats.value === null || occupiedSeats.value === null) return undefined
  if (maxSeats.value === 0) return undefined
  return Math.max(0, maxSeats.value - occupiedSeats.value)
})

const showInviteBlock = computed(
  () => maxSeats.value === 0 || (maxSeats.value ?? 0) > 1
)

const invitedEmails = ref<string[]>([])
const invitedMessage = ref<HTMLElement>()

const inviteForm = ref<InstanceType<typeof InviteMembersForm>>()
const canSendInvites = computed(
  () =>
    maxSeats.value !== null &&
    occupiedSeats.value !== null &&
    (inviteForm.value?.canSubmit ?? false)
)
const isSendingInvites = computed(() => inviteForm.value?.loading ?? false)

function handleSendInvites() {
  if (maxSeats.value === null || occupiedSeats.value === null) return
  void inviteForm.value?.submit()?.catch(console.error)
}

async function onInvited(emails: string[]) {
  invitedEmails.value = emails
  await nextTick()
  invitedMessage.value?.focus()
}
</script>
