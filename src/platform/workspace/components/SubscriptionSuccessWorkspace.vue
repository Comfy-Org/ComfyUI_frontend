<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm"
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
        class="mt-4 flex w-full flex-col gap-1 rounded-xl border border-border-default bg-base-background p-4"
      >
        <span class="text-sm text-base-foreground">{{ tierName }}</span>
        <div class="flex items-baseline gap-1">
          <span class="text-2xl font-semibold text-base-foreground">
            ${{ displayPrice }}
          </span>
          <span class="text-sm text-base-foreground">
            {{ priceUnitLabel }}
          </span>
        </div>
        <div class="flex items-center gap-1 text-sm text-muted-foreground">
          <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
          <span>{{ displayCredits }} {{ creditsUnitLabel }}</span>
        </div>
      </div>

      <div v-if="showInviteBlock" class="mt-4 flex w-full flex-col gap-2">
        <h3 class="m-0 text-base font-semibold text-base-foreground">
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
            source="post_upgrade_success"
            :submit-label="$t('subscription.success.sendInvites')"
            :placeholder="$t('subscription.success.inviteEmailsPlaceholder')"
            :max-seats="invitableSeats"
            @submitted="onInvited"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-8">
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
        variant="secondary"
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
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import Button from '@/components/ui/button/Button.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { isYearlyCheckout } from '@/platform/cloud/subscription/utils/planDuration'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import {
  MAX_WORKSPACE_MEMBERS,
  useTeamWorkspaceStore
} from '@/platform/workspace/stores/teamWorkspaceStore'

import InviteMembersForm from './InviteMembersForm.vue'

const {
  tierKey,
  previewData = null,
  teamPlan = null,
  isTeam = false,
  billingCycle = 'monthly'
} = defineProps<{
  tierKey?: Exclude<TierKey, 'free' | 'founder'> | null
  previewData?: PreviewSubscribeResponse | null
  teamPlan?: TeamPlanSelection | null
  isTeam?: boolean
  /** Cycle the purchase was made under. Drives whether the price/credit line
   *  below reads as a monthly or yearly total (falls back to the resolved
   *  preview's plan duration when one is present). */
  billingCycle?: BillingCycle
}>()

defineEmits<{
  close: []
}>()

const { t, n } = useI18n()
const { flags } = useFeatureFlags()
const workspaceStore = useTeamWorkspaceStore()

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

// The preview's resolved plan duration wins when present (it reflects what was
// actually purchased); otherwise fall back to the selected billing cycle
// (the team-plan path has no preview duration to consult).
const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan?.duration, billingCycle)
)

// The actual total charged for the purchased cycle — the annual price when
// billed yearly, not a monthly-equivalent figure mislabeled as such.
const displayPrice = computed(() => {
  if (teamPlan) {
    const usd = isYearly.value
      ? teamPlan.discountedUsd * 12
      : teamPlan.discountedUsd
    return String(usd)
  }
  if (!previewData?.new_plan) return '0'
  return (previewData.new_plan.price_cents / 100).toFixed(0)
})

const priceUnitLabel = computed(() =>
  isYearly.value ? t('subscription.usdPerYear') : t('subscription.usdPerMonth')
)

// The credit grant's own monthly figure, annualized (×12) to match the
// yearly total price shown above when the purchase is billed yearly.
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

const occupiedSeats = computed(() =>
  Math.max(
    1,
    workspaceStore.members.length + workspaceStore.pendingInvites.length
  )
)
const invitableSeats = computed(() =>
  Math.max(0, MAX_WORKSPACE_MEMBERS - occupiedSeats.value)
)

const showInviteBlock = computed(() => isTeam && flags.teamWorkspacesEnabled)

const invitedEmails = ref<string[]>([])
const invitedMessage = ref<HTMLElement>()

const inviteForm = ref<InstanceType<typeof InviteMembersForm>>()
const canSendInvites = computed(() => inviteForm.value?.canSubmit ?? false)
const isSendingInvites = computed(() => inviteForm.value?.loading ?? false)

function handleSendInvites() {
  void inviteForm.value?.submit()?.catch(console.error)
}

async function onInvited(emails: string[]) {
  invitedEmails.value = emails
  await nextTick()
  invitedMessage.value?.focus()
}
</script>
