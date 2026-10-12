<template>
  <CheckoutSuccess
    :plan="checkoutPlan(tierKey, teamPlan)"
    :copy="successCopy"
    :locale
    :preview-data
    :billing-cycle
    :dark-surface
    :promo-applied
    :close-demoted="showInviteBlock && invitedEmails.length === 0"
    @close="$emit('close')"
  >
    <template #details>
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
            class="m-0 text-sm text-success-background"
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
            :max-seats="inviteFormMaxSeats"
            :occupied-seats="inviteFormOccupiedSeats"
            @submitted="onInvited"
          />
        </div>
      </div>
    </template>
    <template #actions>
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
    </template>
  </CheckoutSuccess>
</template>

<script setup lang="ts">
/**
 * The cloud app's binding of the shared success step, plus the team invite
 * that follows a multi-seat upgrade (ADR BILLING-WEB-0038).
 */
import { CheckoutSuccess } from '@comfyorg/account-ui/billing/checkout'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { useCheckoutCopy } from '@/platform/workspace/composables/useCheckoutCopy'

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

const { locale } = useI18n()
const { successCopy, checkoutPlan } = useCheckoutCopy()
const { maxSeats, occupiedSeats } = useBillingContext()

const inviteFormMaxSeats = computed(() => maxSeats.value)
const inviteFormOccupiedSeats = computed(() => occupiedSeats.value)
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
