<template>
  <div class="grow overflow-auto pt-6">
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
            <!-- OWNER Unsubscribed State -->
            <template v-if="showSubscribePrompt">
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

            <!-- Normal Subscribed State (Owner with subscription, or member viewing subscribed workspace) -->
            <template v-else>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-text-primary">
                    {{ subscriptionTierName }}
                  </span>
                  <StatusBadge
                    v-if="isCancelled"
                    :label="$t('subscription.canceled')"
                    severity="warn"
                  />
                </div>
                <div class="flex items-baseline gap-1 font-inter font-semibold">
                  <span class="text-2xl">${{ tierPrice }}</span>
                  <span class="text-base">
                    {{
                      isInPersonalWorkspace
                        ? $t('subscription.usdPerMonth')
                        : $t('subscription.usdPerMonthPerMember')
                    }}
                  </span>
                </div>
                <div
                  v-if="canAccessSubscriptionFeatures"
                  :class="
                    cn(
                      'text-sm',
                      isCancelled
                        ? 'text-warning-background'
                        : 'text-text-secondary'
                    )
                  "
                >
                  <template v-if="isCancelled">
                    {{
                      $t('subscription.expiresDate', {
                        date: formattedEndDate
                      })
                    }}
                  </template>
                  <template v-else>
                    {{
                      $t('subscription.renewsDate', {
                        date: formattedRenewalDate
                      })
                    }}
                  </template>
                </div>
              </div>

              <div
                v-if="
                  canAccessSubscriptionFeatures &&
                  permissions.canManageSubscription
                "
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

                <!-- Active state: show Manage Payment, Upgrade, and menu -->
                <template v-else>
                  <Button
                    v-if="!isFreeTierPlan"
                    size="lg"
                    variant="secondary"
                    class="rounded-lg bg-interface-menu-component-surface-selected px-4 text-sm font-normal text-text-primary"
                    @click="manageSubscription"
                  >
                    {{ $t('subscription.managePayment') }}
                  </Button>
                  <Button
                    size="lg"
                    variant="primary"
                    class="rounded-lg px-4 text-sm font-normal text-text-primary"
                    @click="handleUpgrade"
                  >
                    {{ $t('subscription.upgradePlan') }}
                  </Button>
                  <Button
                    v-if="!isFreeTierPlan && planMenuItems.length > 0"
                    v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                    variant="secondary"
                    size="lg"
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

          <div v-if="canAccessSubscriptionFeatures" class="flex flex-col gap-2">
            <div class="text-sm text-text-primary">
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

      <!-- Members invoice card -->
      <div
        v-if="
          canAccessSubscriptionFeatures &&
          !isInPersonalWorkspace &&
          permissions.canManageSubscription
        "
        class="mt-6 flex items-center justify-between gap-1 rounded-2xl border border-interface-stroke p-6 text-sm"
      >
        <div class="flex flex-col gap-2">
          <h4 class="m-0 text-sm text-text-primary">
            {{ $t('subscription.nextMonthInvoice') }}
          </h4>
          <span
            class="cursor-pointer text-muted-foreground underline"
            @click="manageSubscription"
          >
            {{ $t('subscription.invoiceHistory') }}
          </span>
        </div>
        <div class="flex flex-col items-end gap-2">
          <h4 class="m-0 font-bold">${{ nextMonthInvoice }}</h4>
          <h5 class="m-0 text-muted-foreground">
            {{ $t('subscription.memberCount', memberCount) }}
          </h5>
        </div>
      </div>

      <!-- View More Details - Outside main content -->
      <div
        v-if="permissions.canManageSubscription"
        class="flex items-center gap-2 py-6"
      >
        <i class="pi pi-external-link text-muted"></i>
        <a
          href="https://www.comfy.org/cloud/pricing"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-muted underline hover:opacity-80"
        >
          {{ $t('subscription.viewMoreDetailsPlans') }}
        </a>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Menu from 'primevue/menu'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useToast } from 'primevue/usetoast'

import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
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
import { cn } from '@comfyorg/tailwind-utils'

const workspaceStore = useTeamWorkspaceStore()
const { isWorkspaceSubscribed, isInPersonalWorkspace, members } =
  storeToRefs(workspaceStore)
const { permissions } = useWorkspaceUI()
const { t, n } = useI18n()
const toast = useToast()

const billingOperationStore = useBillingOperationStore()
const isSettingUp = computed(() => billingOperationStore.isSettingUp)

const {
  canAccessSubscriptionFeatures,
  isFreeTier: isFreeTierPlan,
  isTeamPlan,
  subscription,
  showSubscriptionDialog,
  manageSubscription,
  getMaxSeats,
  resubscribe
} = useBillingContext()

const { showCancelSubscriptionDialog } = useDialogService()
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
  if (isInPersonalWorkspace.value) return !canAccessSubscriptionFeatures.value
  return !isWorkspaceSubscribed.value
})

// MEMBER view without subscription - members can't manage subscription
const isMemberView = computed(
  () =>
    !permissions.value.canManageSubscription &&
    !canAccessSubscriptionFeatures.value &&
    !isWorkspaceSubscribed.value
)

// Show zero state for credits (no real billing data yet)
const showZeroState = computed(
  () => showSubscribePrompt.value || isMemberView.value
)

// Subscribe workspace - opens the subscription dialog (personal or workspace variant)
function handleSubscribeWorkspace() {
  showSubscriptionDialog()
}

function handleUpgrade() {
  if (isFreeTierPlan.value) showPricingTable()
  else showSubscriptionDialog()
}

const subscriptionTier = computed(() => subscription.value?.tier ?? null)
const isYearlySubscription = computed(
  () => subscription.value?.duration === 'ANNUAL'
)

const formattedRenewalDate = computed(() => {
  if (!subscription.value?.renewalDate) return ''
  const renewalDate = new Date(subscription.value.renewalDate)
  return renewalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

const formattedEndDate = computed(() => {
  if (!subscription.value?.endDate) return ''
  const endDate = new Date(subscription.value.endDate)
  return endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

const subscriptionTierName = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return ''
  const key = TIER_TO_KEY[tier] ?? 'standard'
  const baseName = t(`subscription.tiers.${key}.name`)
  return isYearlySubscription.value
    ? t('subscription.tierNameYearly', { name: baseName })
    : baseName
})

const planMenu = ref<InstanceType<typeof Menu> | null>(null)

// Cancel is original-owner-only (creator); a promoted owner gets no menu items
// and the "more options" button is hidden (see template).
const planMenuItems = computed(() =>
  permissions.value.canManageSubscriptionLifecycle
    ? [
        {
          label: t('subscription.cancelSubscription'),
          icon: 'pi pi-times',
          command: () => {
            showCancelSubscriptionDialog(
              subscription.value?.endDate ?? undefined
            )
          }
        }
      ]
    : []
)

const tierKey = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})
const tierPrice = computed(() =>
  getTierPrice(tierKey.value, isYearlySubscription.value)
)

const memberCount = computed(() => members.value.length)
const nextMonthInvoice = computed(() => memberCount.value * tierPrice.value)

const tierBenefits = computed((): TierBenefit[] => {
  const key = tierKey.value
  const benefits: TierBenefit[] = []

  if (!isInPersonalWorkspace.value) {
    benefits.push({
      key: 'members',
      type: 'feature',
      label: t('subscription.membersLabel', { count: getMaxSeats(key) })
    })
  }

  benefits.push(...getCommonTierBenefits(key, t, n))
  return benefits
})
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
