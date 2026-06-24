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
            {{ $t('subscription.usdPerMonth') }}
          </span>
        </div>
        <div class="flex items-center gap-1 text-sm text-muted-foreground">
          <i class="icon-[comfy--credits] size-4 shrink-0 bg-amber-400" />
          <span>{{ displayCredits }} {{ $t('subscription.perMonth') }}</span>
        </div>
      </div>

      <div v-if="showInviteBlock" class="mt-4 flex w-full flex-col gap-2">
        <h3 class="m-0 text-base font-semibold text-base-foreground">
          {{ $t('subscription.success.inviteTitle') }}
        </h3>
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('subscription.success.inviteSubtext') }}
        </p>
        <p
          v-if="invitedEmails.length > 0"
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import Button from '@/components/ui/button/Button.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import { getTierCredits } from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { MAX_WORKSPACE_MEMBERS } from '@/platform/workspace/stores/teamWorkspaceStore'

import InviteMembersForm from './InviteMembersForm.vue'

const {
  tierKey,
  previewData = null,
  teamPlan = null,
  isTeam = false
} = defineProps<{
  tierKey?: Exclude<TierKey, 'free' | 'founder'> | null
  previewData?: PreviewSubscribeResponse | null
  teamPlan?: TeamPlanSelection | null
  isTeam?: boolean
}>()

defineEmits<{
  close: []
}>()

const { t, n } = useI18n()
const { flags } = useFeatureFlags()

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

const displayPrice = computed(() => {
  if (teamPlan) return String(teamPlan.discountedUsd)
  return previewData?.new_plan
    ? (previewData.new_plan.price_cents / 100).toFixed(0)
    : '0'
})

const displayCredits = computed(() =>
  n(teamPlan ? teamPlan.credits : tierKey ? (getTierCredits(tierKey) ?? 0) : 0)
)

// A team plan caps members at a flat MAX_WORKSPACE_MEMBERS; the buyer already
// holds one seat post-upgrade, so invites fill the rest.
const invitableSeats = computed(() => MAX_WORKSPACE_MEMBERS - 1)

const showInviteBlock = computed(() => isTeam && flags.teamWorkspacesEnabled)

const invitedEmails = ref<string[]>([])

const inviteForm = ref<InstanceType<typeof InviteMembersForm>>()
const canSendInvites = computed(() => inviteForm.value?.canSubmit ?? false)
const isSendingInvites = computed(() => inviteForm.value?.loading ?? false)

function handleSendInvites() {
  void inviteForm.value?.submit()
}

function onInvited(emails: string[]) {
  invitedEmails.value = emails
}
</script>
