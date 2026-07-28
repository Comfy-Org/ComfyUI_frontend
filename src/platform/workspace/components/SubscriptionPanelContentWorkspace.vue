<template>
  <div class="flex grow flex-col overflow-auto pt-6">
    <!-- Loading state while subscription is being set up -->
    <div
      v-if="isSettingUp"
      class="rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-center gap-2 py-4 text-muted-foreground">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ $t('billingOperation.subscriptionProcessing') }}</span>
      </div>
    </div>

    <!-- Billing data still loading: avoid rendering a false Free/$0 plan -->
    <div
      v-else-if="isLoading && !subscription"
      class="rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-center gap-2 py-4 text-muted-foreground">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ $t('g.loading') }}</span>
      </div>
    </div>

    <!-- Billing fetch failed: offer retry rather than a misleading Free plan -->
    <div
      v-else-if="error && !subscription"
      class="flex flex-col items-start gap-3 rounded-2xl border border-interface-stroke p-6"
    >
      <div class="flex items-center gap-2 text-text-secondary">
        <i class="pi pi-exclamation-circle text-danger" />
        <span class="text-sm">{{ $t('subscription.planLoadError') }}</span>
      </div>
      <Button
        variant="secondary"
        size="lg"
        class="rounded-lg px-4 text-sm font-normal"
        :loading="isLoading"
        @click="handleRetry"
      >
        {{ $t('subscription.planLoadErrorRetry') }}
      </Button>
    </div>

    <template v-else>
      <!-- Cancelled subscription info card -->
      <div
        v-if="isSubscriptionCancelled"
        class="mb-6 flex gap-1 rounded-2xl border border-warning-background bg-warning-background/20 p-4"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full text-warning-background"
        >
          <i class="pi pi-info-circle" />
        </div>
        <div class="flex flex-col gap-2">
          <h2 class="m-0 pt-1.5 text-sm font-bold text-text-primary">
            {{ $t('subscription.canceledCard.title') }}
          </h2>
          <p class="m-0 text-sm text-text-secondary">
            {{
              $t('subscription.canceledCard.description', {
                date: formattedEndDate
              })
            }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl border border-interface-stroke p-6">
        <div>
          <div
            class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-2"
          >
            <!-- OWNER Unsubscribed TEAM workspace -->
            <template v-if="showTeamSubscribePrompt">
              <div class="flex flex-col gap-2">
                <h3 class="m-0 text-sm font-bold text-text-primary">
                  {{ $t('subscription.workspaceNotSubscribed') }}
                </h3>
                <div class="text-sm text-text-secondary">
                  {{ $t('subscription.subscriptionRequiredMessage') }}
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                class="ml-auto rounded-lg px-4 py-2 text-sm font-normal"
                @click="handleSubscribeWorkspace"
              >
                {{ $t('subscription.subscribeNow') }}
              </Button>
            </template>

            <!-- MEMBER View - read-only, workspace not subscribed -->
            <template v-else-if="isMemberView">
              <div class="flex flex-col gap-2">
                <h3 class="m-0 text-sm font-bold text-text-primary">
                  {{ $t('subscription.workspaceNotSubscribed') }}
                </h3>
                <div class="text-sm text-text-secondary">
                  {{ $t('subscription.contactOwnerToSubscribe') }}
                </div>
              </div>
            </template>

            <!-- OWNER personal workspace without subscription (Free plan) -->
            <template v-else-if="isPersonalFree">
              <div class="flex flex-col gap-2">
                <h3 class="m-0 text-base font-bold text-text-primary">
                  {{ $t('subscription.tiers.free.name') }}
                </h3>
                <div class="flex items-baseline gap-1 font-inter">
                  <span class="text-2xl font-semibold">{{ displayPrice }}</span>
                  <span class="text-base">{{ priceUnitLabel }}</span>
                </div>
              </div>
              <div class="flex flex-wrap gap-2 md:ml-auto">
                <Button
                  variant="primary"
                  size="lg"
                  class="rounded-lg px-4 text-sm font-normal"
                  @click="handleSubscribeWorkspace"
                >
                  {{ $t('subscription.subscribe') }}
                </Button>
                <DropdownMenu
                  v-if="menuEntries.length > 0"
                  :entries="menuEntries"
                >
                  <template #button>
                    <Button
                      v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                      variant="secondary"
                      size="icon-lg"
                      class="rounded-lg bg-interface-menu-component-surface-selected text-text-primary"
                      :aria-label="$t('g.moreOptions')"
                    >
                      <i class="pi pi-ellipsis-h" />
                    </Button>
                  </template>
                </DropdownMenu>
              </div>
            </template>

            <!-- Normal Subscribed State (Owner with subscription, or member viewing subscribed workspace) -->
            <template v-else>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <h3 class="m-0 text-base font-bold text-text-primary">
                    {{ planDisplayName }}
                  </h3>
                  <StatusBadge
                    v-if="isSubscriptionCancelled"
                    :label="$t('subscription.canceled')"
                    severity="warn"
                  />
                </div>
                <div class="flex items-baseline gap-1 font-inter">
                  <span class="text-2xl font-semibold">{{ displayPrice }}</span>
                  <span class="text-base">{{ priceUnitLabel }}</span>
                </div>
                <div
                  v-if="isActiveSubscription"
                  class="text-sm text-text-secondary"
                >
                  <template v-if="isSubscriptionCancelled">
                    {{
                      $t('subscription.endsOnDate', {
                        date: formattedEndDate
                      })
                    }}
                  </template>
                  <template v-else>
                    {{
                      $t('subscription.renewsOnDate', {
                        date: formattedRenewalDate
                      })
                    }}
                  </template>
                </div>
              </div>

              <div
                v-if="isActiveSubscription"
                class="flex flex-wrap gap-2 md:ml-auto"
              >
                <Button
                  v-if="!isFreeTierPlan && permissions.canManageSubscription"
                  size="lg"
                  variant="secondary"
                  class="rounded-lg bg-interface-menu-component-surface-selected px-4 text-sm font-normal text-text-primary"
                  @click="manageSubscription"
                >
                  {{ $t('subscription.manageBilling') }}
                </Button>
                <Button
                  v-if="
                    isSubscriptionCancelled &&
                    permissions.canManageSubscriptionLifecycle
                  "
                  size="lg"
                  variant="primary"
                  class="rounded-lg px-4 text-sm font-normal"
                  :loading="isResubscribing"
                  @click="handleResubscribe"
                >
                  {{ $t('subscription.reactivatePlan') }}
                </Button>
                <Button
                  v-else-if="
                    !isSubscriptionCancelled &&
                    permissions.canManageSubscription
                  "
                  size="lg"
                  variant="secondary"
                  class="rounded-lg bg-interface-menu-component-surface-selected px-4 text-sm font-normal text-text-primary"
                  @click="handleUpgrade"
                >
                  {{
                    isInPersonalWorkspace && !isTeamPlan
                      ? $t('subscription.upgradePlan')
                      : $t('subscription.changePlan')
                  }}
                </Button>
                <DropdownMenu
                  v-if="menuEntries.length > 0"
                  :entries="menuEntries"
                >
                  <template #button>
                    <Button
                      v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                      variant="secondary"
                      size="icon-lg"
                      class="rounded-lg bg-interface-menu-component-surface-selected text-text-primary"
                      :aria-label="$t('g.moreOptions')"
                    >
                      <i class="pi pi-ellipsis-h" />
                    </Button>
                  </template>
                </DropdownMenu>
              </div>
            </template>
          </div>
        </div>

        <div class="flex flex-col gap-6 pt-6 lg:flex-row lg:items-stretch">
          <div class="w-full lg:max-w-md">
            <CreditsTile :zero-state="showZeroState" />
          </div>

          <div
            v-if="isActiveSubscription || isPersonalFree"
            class="flex flex-col gap-2"
          >
            <i18n-t
              v-if="isTeamActive"
              keypath="subscription.teamPlanIncludes"
              tag="div"
              class="text-sm text-muted"
            >
              <template #plan>
                <span class="text-text-primary">
                  {{ $t('subscription.tiers.pro.name') }}
                </span>
              </template>
            </i18n-t>
            <div v-else-if="isPersonalFree" class="text-sm text-muted">
              {{ $t('subscription.whatsIncluded') }}
            </div>
            <div v-else class="text-sm text-text-primary">
              {{ $t('subscription.yourPlanIncludes') }}
            </div>

            <div class="flex flex-col gap-0">
              <div
                v-for="benefit in tierBenefits"
                :key="benefit.key"
                class="flex items-center gap-2 py-2"
              >
                <i
                  v-if="benefit.type === 'feature'"
                  class="pi pi-check text-xs text-text-primary"
                />
                <span
                  v-else-if="benefit.type === 'metric' && benefit.value"
                  class="text-sm font-normal whitespace-nowrap text-text-primary"
                >
                  {{ benefit.value }}
                </span>
                <span class="text-sm text-muted">
                  {{ benefit.label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- View More Details - Outside main content -->
      <div v-if="permissions.canManageSubscription" class="py-6">
        <Button
          variant="muted-textonly"
          class="text-sm text-muted"
          @click="handleViewMoreDetails"
        >
          {{ $t('subscription.viewMoreDetailsPlans') }}
          <i class="pi pi-external-link text-muted" />
        </Button>
      </div>

      <SubscriptionFooterLinks
        class="mt-auto pt-6"
        :show-invoice-history="permissions.canManageSubscription"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import DropdownMenu from '@/components/common/DropdownMenu.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { TierBenefit } from '@/platform/cloud/subscription/utils/tierBenefits'
import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useWorkspaceMenuItems } from '@/platform/workspace/composables/useWorkspaceMenuItems'
import { useWorkspacePlanPricing } from '@/platform/workspace/composables/useWorkspacePlanPricing'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  formatSubscriptionDate,
  resolveSubscriptionTierKey
} from './subscriptionPanelWorkspace.logic'

const workspaceStore = useTeamWorkspaceStore()
const { isWorkspaceSubscribed, isInPersonalWorkspace } =
  storeToRefs(workspaceStore)
const { permissions, isSubscriptionCancelled } = useWorkspaceUI()
const { t, n, locale } = useI18n()

const billingOperationStore = useBillingOperationStore()
const isSettingUp = computed(() => billingOperationStore.isSettingUp)

const {
  isActiveSubscription,
  isFreeTier: isFreeTierPlan,
  isTeamPlan,
  subscription,
  isLoading,
  error,
  showSubscriptionDialog,
  manageSubscription,
  initialize
} = useBillingContext()

const { showPricingTable } = useSubscriptionDialog()

const { isResubscribing, handleResubscribe } = useResubscribe()
const { displayPrice, priceUnitLabel } = useWorkspacePlanPricing()
const { menuEntries } = useWorkspaceMenuItems()

// Show subscribe prompt to owners without active subscription. A cancelled plan
// stays active until its end date, so it keeps the subscribed treatment.
const showSubscribePrompt = computed(() => {
  if (!permissions.value.canManageSubscription) return false
  if (isSubscriptionCancelled.value) return false
  if (
    subscription.value &&
    !isFreeTierPlan.value &&
    (subscription.value.planSlug || subscription.value.tier)
  )
    return false
  if (isInPersonalWorkspace.value) return !isActiveSubscription.value
  return !isWorkspaceSubscribed.value
})

const showTeamSubscribePrompt = computed(
  () => showSubscribePrompt.value && !isInPersonalWorkspace.value
)

const isPersonalFree = computed(
  () => showSubscribePrompt.value && isInPersonalWorkspace.value
)

const isTeamActive = computed(
  () => isTeamPlan.value && isActiveSubscription.value
)

const isMemberView = computed(
  () =>
    !permissions.value.canManageSubscription &&
    !isActiveSubscription.value &&
    !isWorkspaceSubscribed.value
)

const showZeroState = computed(
  () => showTeamSubscribePrompt.value || isMemberView.value
)

function handleSubscribeWorkspace() {
  showSubscriptionDialog({ reason: 'settings_billing_panel' })
}

function handleUpgrade() {
  if (isFreeTierPlan.value)
    showPricingTable({ reason: 'settings_billing_panel' })
  else showSubscriptionDialog({ reason: 'settings_billing_panel' })
}

function handleViewMoreDetails() {
  window.open('https://www.comfy.org/cloud/pricing', '_blank')
}

async function handleRetry() {
  await initialize()
}

const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)

const formattedRenewalDate = computed(() =>
  formatSubscriptionDate(subscription.value?.renewalDate, locale.value)
)

const formattedEndDate = computed(() =>
  formatSubscriptionDate(subscription.value?.endDate, locale.value)
)

const subscriptionTierName = computed(() => {
  const tier = subscription.value?.tier
  if (!tier) return ''
  const key = resolveSubscriptionTierKey(tier)
  const baseName = t(`subscription.tiers.${key}.name`)
  return isYearlySubscription.value
    ? t('subscription.tierNameYearly', { name: baseName })
    : baseName
})

const planDisplayName = computed(() =>
  isTeamPlan.value ? t('subscription.teamPlanName') : subscriptionTierName.value
)

const tierKey = computed(() =>
  resolveSubscriptionTierKey(subscription.value?.tier)
)

const TEAM_PERK_KEYS = [
  'inviteMembers',
  'concurrentRuns',
  'sharedCreditPool',
  'rolePermissions'
] as const

const tierBenefits = computed((): TierBenefit[] => {
  if (isTeamActive.value) {
    return TEAM_PERK_KEYS.map((key) => ({
      key,
      type: 'feature',
      label: t(`subscription.teamPerks.${key}`)
    }))
  }
  if (isPersonalFree.value) {
    return [
      {
        key: 'maxRuntime',
        type: 'feature',
        label: t('subscription.freePerks.maxRuntime', {
          duration: t('subscription.maxDuration.free')
        })
      }
    ]
  }
  return getCommonTierBenefits(tierKey.value, t, n)
})
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
