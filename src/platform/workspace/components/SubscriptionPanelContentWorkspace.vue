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

    <template v-else>
      <!-- Cancelled subscription info card -->
      <div
        v-if="isCancelled"
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
                <div class="text-sm font-bold text-text-primary">
                  {{ $t('subscription.workspaceNotSubscribed') }}
                </div>
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
                <div class="text-sm font-bold text-text-primary">
                  {{ $t('subscription.workspaceNotSubscribed') }}
                </div>
                <div class="text-sm text-text-secondary">
                  {{ $t('subscription.contactOwnerToSubscribe') }}
                </div>
              </div>
            </template>

            <!-- OWNER personal workspace without subscription (Free plan) -->
            <template v-else-if="isPersonalFree">
              <div class="flex flex-col gap-2">
                <span class="text-base font-bold text-text-primary">
                  {{ $t('subscription.tiers.free.name') }}
                </span>
                <div class="flex items-baseline gap-1 font-inter">
                  <span class="text-2xl font-semibold">
                    ${{ freeTierPrice }}
                  </span>
                  <span class="text-base">
                    {{ $t('subscription.usdPerMonth') }}
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                class="rounded-lg px-4 text-sm font-normal md:ml-auto"
                @click="handleSubscribeWorkspace"
              >
                {{ $t('subscription.subscribe') }}
              </Button>
            </template>

            <!-- Normal Subscribed State (Owner with subscription, or member viewing subscribed workspace) -->
            <template v-else>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-base font-bold text-text-primary">
                    {{ planDisplayName }}
                  </span>
                  <StatusBadge
                    v-if="isCancelled"
                    :label="$t('subscription.canceled')"
                    severity="warn"
                  />
                </div>
                <div class="flex items-baseline gap-1 font-inter">
                  <span class="text-2xl font-semibold"
                    >${{ displayPrice }}</span
                  >
                  <span class="text-base">{{ priceUnitLabel }}</span>
                </div>
                <div
                  v-if="isActiveSubscription"
                  class="text-sm text-text-secondary"
                >
                  <template v-if="isCancelled">
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
                <!-- Cancelled state: reactivation is original-owner-only. -->
                <template v-if="isCancelled">
                  <Button
                    v-if="permissions.canManageSubscriptionLifecycle"
                    size="lg"
                    variant="primary"
                    class="rounded-lg px-4 text-sm font-normal"
                    :loading="isResubscribing"
                    @click="handleResubscribe"
                  >
                    {{ $t('subscription.resubscribe') }}
                  </Button>
                </template>

                <!-- Owners manage the plan; members and non-creator owners can still leave -->
                <template v-else>
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
                    v-if="permissions.canManageSubscription"
                    size="lg"
                    variant="secondary"
                    class="rounded-lg bg-interface-menu-component-surface-selected px-4 text-sm font-normal text-text-primary"
                    @click="handleUpgrade"
                  >
                    {{
                      isInPersonalWorkspace
                        ? $t('subscription.upgradePlan')
                        : $t('subscription.changePlan')
                    }}
                  </Button>
                  <Button
                    v-if="planMenuItems.length > 0"
                    v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                    variant="secondary"
                    size="icon-lg"
                    class="rounded-lg bg-interface-menu-component-surface-selected text-text-primary"
                    :aria-label="$t('g.moreOptions')"
                    @click="planMenu?.toggle($event)"
                  >
                    <i class="pi pi-ellipsis-h" />
                  </Button>
                  <Menu ref="planMenu" :model="planMenuItems" :popup="true" />
                </template>
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

      <SubscriptionFooterLinks class="mt-auto pt-6" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Menu from 'primevue/menu'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from 'primevue/menuitem'
import { useToast } from 'primevue/usetoast'

import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import SubscriptionFooterLinks from '@/platform/cloud/subscription/components/SubscriptionFooterLinks.vue'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useDialogService } from '@/services/dialogService'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import type { TierBenefit } from '@/platform/cloud/subscription/utils/tierBenefits'
import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const workspaceStore = useTeamWorkspaceStore()
const {
  isWorkspaceSubscribed,
  isInPersonalWorkspace,
  members,
  isCurrentUserOriginalOwner
} = storeToRefs(workspaceStore)
const { permissions } = useWorkspaceUI()
const { t, n, locale } = useI18n()
const toast = useToast()

const billingOperationStore = useBillingOperationStore()
const isSettingUp = computed(() => billingOperationStore.isSettingUp)

const {
  isActiveSubscription,
  isFreeTier: isFreeTierPlan,
  subscription,
  plans,
  currentPlanSlug,
  showSubscriptionDialog,
  manageSubscription,
  resubscribe
} = useBillingContext()

const { showCancelSubscriptionDialog, showLeaveWorkspaceDialog } =
  useDialogService()
const { showPricingTable } = useSubscriptionDialog()

const isResubscribing = ref(false)

async function handleResubscribe() {
  isResubscribing.value = true
  try {
    await resubscribe()
    toast.add({
      severity: 'success',
      summary: t('subscription.resubscribeSuccess'),
      life: 5000
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resubscribe'
    toast.add({
      severity: 'error',
      summary: t('g.error'),
      detail: message
    })
  } finally {
    isResubscribing.value = false
  }
}

// Only show cancelled state for team workspaces (workspace billing)
// Personal workspaces use legacy billing which has different cancellation semantics
const isCancelled = computed(
  () =>
    !isInPersonalWorkspace.value && (subscription.value?.isCancelled ?? false)
)

// Show subscribe prompt to owners without active subscription
// Don't show if subscription is cancelled (still active until end date)
const showSubscribePrompt = computed(() => {
  if (!permissions.value.canManageSubscription) return false
  if (isCancelled.value) return false
  if (isInPersonalWorkspace.value) return !isActiveSubscription.value
  return !isWorkspaceSubscribed.value
})

const showTeamSubscribePrompt = computed(
  () => showSubscribePrompt.value && !isInPersonalWorkspace.value
)

// Personal workspace without subscription renders the Free plan header
const isPersonalFree = computed(
  () => showSubscribePrompt.value && isInPersonalWorkspace.value
)

const isTeamActive = computed(
  () => !isInPersonalWorkspace.value && isActiveSubscription.value
)

// MEMBER view without subscription - members can't manage subscription
const isMemberView = computed(
  () =>
    !permissions.value.canManageSubscription &&
    !isActiveSubscription.value &&
    !isWorkspaceSubscribed.value
)

// Show zero state for credits (no real billing data yet)
const showZeroState = computed(
  () => showTeamSubscribePrompt.value || isMemberView.value
)

// Subscribe workspace - opens the subscription dialog (personal or workspace variant)
function handleSubscribeWorkspace() {
  showSubscriptionDialog()
}

function handleUpgrade() {
  if (isFreeTierPlan.value) showPricingTable()
  else showSubscriptionDialog()
}

function handleViewMoreDetails() {
  window.open('https://www.comfy.org/cloud/pricing', '_blank')
}

const subscriptionTier = computed(() => subscription.value?.tier ?? null)
const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)

function formatSubtitleDate(isoDate: string | null | undefined) {
  if (!isoDate) return ''
  return new Date(isoDate).toLocaleDateString(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const formattedRenewalDate = computed(() =>
  formatSubtitleDate(subscription.value?.renewalDate)
)

const formattedEndDate = computed(() =>
  formatSubtitleDate(subscription.value?.endDate)
)

const subscriptionTierName = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return ''
  const key = TIER_TO_KEY[tier] ?? 'standard'
  const baseName = t(`subscription.tiers.${key}.name`)
  return isYearlySubscription.value
    ? t('subscription.tierNameYearly', { name: baseName })
    : baseName
})

const planDisplayName = computed(() =>
  isInPersonalWorkspace.value
    ? subscriptionTierName.value
    : t('subscription.teamPlanName')
)

const planMenu = ref<InstanceType<typeof Menu> | null>(null)

const planMenuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = []
  // Cancel is original-owner-only (creator); promoted owners get no cancel item.
  if (
    permissions.value.canManageSubscriptionLifecycle &&
    !isFreeTierPlan.value
  ) {
    items.push({
      label: t('subscription.cancelSubscription'),
      icon: 'pi pi-times',
      command: () => {
        showCancelSubscriptionDialog(subscription.value?.endDate ?? undefined)
      }
    })
  }
  // Members and non-creator owners can leave; the creator sees it disabled.
  if (!isInPersonalWorkspace.value) {
    items.push(
      isCurrentUserOriginalOwner.value
        ? {
            label: t('workspacePanel.menu.leaveWorkspace'),
            icon: 'pi pi-sign-out',
            disabled: true
          }
        : {
            label: t('workspacePanel.menu.leaveWorkspace'),
            icon: 'pi pi-sign-out',
            command: () => void showLeaveWorkspaceDialog()
          }
    )
  }
  return items
})

const tierKey = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})
const tierPrice = computed(() =>
  getTierPrice(tierKey.value, isYearlySubscription.value)
)

const freeTierPrice = getTierPrice('free')

const currentPlan = computed(() =>
  isInPersonalWorkspace.value
    ? undefined
    : plans.value.find((plan) => plan.slug === currentPlanSlug.value)
)
// Seat-aware workspace total (design shows the whole-workspace price); the
// per-member tier price remains the fallback until plans resolve
const workspacePlanCost = computed(() =>
  currentPlan.value
    ? (currentPlan.value.seat_summary.total_cost_cents / 100).toFixed(0)
    : null
)
const displayPrice = computed(() => workspacePlanCost.value ?? tierPrice.value)
const priceUnitLabel = computed(() =>
  workspacePlanCost.value !== null || isInPersonalWorkspace.value
    ? t('subscription.usdPerMonth')
    : t('subscription.usdPerMonthPerMember')
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
