<template>
  <div
    class="flex min-h-0 scrollbar-hide flex-1 flex-col gap-4 overflow-y-auto pb-6"
  >
    <!-- Plan + credits + member snapshot -->
    <div
      class="flex flex-col gap-6 rounded-2xl border border-interface-stroke/60 p-6"
    >
      <!-- Lapsed team/enterprise plan: reactivation header replaces the live one -->
      <div
        v-if="isInactive"
        class="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm text-base-foreground">
            {{ inactiveTitle }}
          </span>
          <span class="text-sm text-muted-foreground">
            {{ inactiveSubtitle }}
          </span>
        </div>
        <div v-if="canManageBilling" class="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="lg" @click="manageSubscription">
            {{ $t('workspacePanel.overview.managePayment') }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            :loading="isResubscribing"
            @click="handleResubscribe"
          >
            {{ $t('workspacePanel.overview.inactive.reactivate') }}
          </Button>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm text-base-foreground">{{ plan.name }}</span>
          <p
            v-if="canManageBilling"
            class="m-0 flex items-center gap-1.5 text-base font-semibold whitespace-nowrap text-base-foreground"
          >
            <i class="icon-[lucide--coins] size-4 text-credit" />
            {{ plan.cycleCredits.toLocaleString() }}
            <span class="text-base font-normal text-muted-foreground">
              / {{ plan.billingPeriod }}
            </span>
          </p>
          <span class="text-sm text-muted-foreground">
            {{
              isPaused
                ? $t('workspacePanel.overview.paused')
                : $t('workspacePanel.overview.renewsOn', {
                    date: plan.renewalLabel
                  })
            }}
          </span>
        </div>
        <div v-if="canManageBilling" class="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="lg" @click="manageSubscription">
            {{ $t('workspacePanel.overview.managePayment') }}
          </Button>
          <Button
            v-if="isOriginalOwner"
            variant="secondary"
            size="lg"
            @click="handleChangePlan"
          >
            {{ $t('workspacePanel.overview.changePlan') }}
          </Button>
          <DropdownMenu
            v-if="planMenuEntries.length > 0"
            :entries="planMenuEntries"
            :modal="false"
          >
            <template #button>
              <Button
                v-tooltip="{ value: $t('g.moreOptions'), showDelay: 300 }"
                variant="secondary"
                size="icon-lg"
                class="rounded-lg"
                :aria-label="$t('g.moreOptions')"
              >
                <i class="icon-[lucide--ellipsis] size-4" />
              </Button>
            </template>
          </DropdownMenu>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
        <CreditsTile class="border-0" :frozen="isInactive" />

        <!-- Member snapshot tile (hidden while the plan is lapsed) -->
        <div
          v-if="canManageBilling && !isInactive"
          class="flex flex-col gap-3 rounded-xl bg-modal-panel-background px-6 py-5"
        >
          <Tabs v-model="snapshotView">
            <TabsList>
              <TabsTrigger value="top">
                {{ $t('workspacePanel.overview.snapshot.topSpenders') }}
              </TabsTrigger>
              <TabsTrigger value="recent">
                {{ $t('workspacePanel.overview.snapshot.recentActivity') }}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div
            v-if="snapshotEmptyMessage"
            class="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center"
          >
            <i class="icon-[lucide--coins] size-6 text-muted-foreground" />
            <p class="m-0 text-sm text-base-foreground">
              {{ snapshotEmptyMessage }}
            </p>
          </div>

          <div
            v-else
            ref="snapshotContainer"
            class="min-h-0 flex-1 overflow-hidden"
          >
            <Table>
              <TableHeader>
                <TableRow
                  class="hover:bg-transparent [&>th]:h-9 [&>th]:border-b [&>th]:border-interface-stroke/60"
                >
                  <TableHead>
                    {{ $t('workspacePanel.overview.snapshot.user') }}
                  </TableHead>
                  <TableHead>
                    {{ $t('workspacePanel.overview.snapshot.lastActivity') }}
                  </TableHead>
                  <TableHead class="text-right">
                    <span class="inline-flex items-center gap-1">
                      <i class="icon-[lucide--coins] size-4" />
                      {{ $t('workspacePanel.overview.snapshot.creditsUsed') }}
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in snapshotRows"
                  :key="row.userName"
                  class="hover:bg-transparent [&:last-child>td]:border-b-0 [&>td]:border-b [&>td]:border-interface-stroke/20"
                >
                  <TableCell>
                    <div class="flex items-center gap-2">
                      <span
                        class="flex size-5 shrink-0 items-center justify-center rounded-full"
                        :style="{ backgroundColor: row.color }"
                      >
                        <span class="text-2xs font-bold text-base-foreground">
                          {{ row.userName.charAt(0).toUpperCase() }}
                        </span>
                      </span>
                      <span class="text-sm text-base-foreground">
                        {{ row.userName }}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell class="text-sm text-muted-foreground tabular-nums">
                    {{ row.lastActivity }}
                  </TableCell>
                  <TableCell
                    class="text-right text-sm text-base-foreground tabular-nums"
                  >
                    {{ row.credits.toLocaleString() }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <Button
            variant="tertiary"
            size="lg"
            class="mt-auto w-full"
            @click="handleSeeMore"
          >
            {{ $t('workspacePanel.overview.seeMore') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- mt-auto floats the footer to the panel's bottom edge; pb-6 (matching
    the other tabs) keeps it level with their footers. -->
    <div
      class="mt-auto flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground @2xl:h-8"
    >
      <a
        :href="learnMoreUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex cursor-pointer items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-base-foreground"
      >
        <i class="icon-[lucide--circle-help] size-4" />
        {{ $t('workspacePanel.overview.learnMore') }}
      </a>
      <a
        :href="partnerNodesPricingUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="flex cursor-pointer items-center gap-1 text-muted-foreground no-underline transition-colors hover:text-base-foreground"
      >
        <i class="icon-[lucide--circle-help] size-4" />
        {{ $t('workspacePanel.overview.pricingTable') }}
      </a>
      <button
        class="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-[inherit] text-sm text-muted-foreground transition-colors hover:text-base-foreground"
        @click="openSupport"
      >
        <i class="icon-[lucide--message-circle] size-4" />
        {{ $t('workspacePanel.overview.messageSupport') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MenuItem } from 'primevue/menuitem'

import DropdownMenu from '@/components/common/DropdownMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useExternalLink } from '@/composables/useExternalLink'
import { useSettingsNavigation } from '@/platform/settings/composables/useSettingsNavigation'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import { buildSupportUrl } from '@/platform/support/config'
import { useAutoPageSize } from '@/platform/workspace/composables/useAutoPageSize'
import { requestMembersSort } from '@/platform/workspace/composables/useMembersPanel'
import { useResubscribe } from '@/platform/workspace/composables/useResubscribe'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'
import { useWorkspaceOverview } from '@/platform/workspace/composables/useWorkspaceOverview'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const { t } = useI18n()

// Plan lifecycle actions are for the workspace creator (Owner) only; Admins and
// Members don't see Change plan or the overflow menu.
const {
  isOriginalOwner,
  isActiveSubscription,
  isTeamPlanCancelled,
  permissions
} = useWorkspaceUI()

// Members can't manage or view billing details — only the credit balance. Gates
// the plan price, payment/plan actions, snapshot, next invoice, and auto-reload.
const canManageBilling = computed(() => permissions.value.canManageSubscription)
const {
  isFreeTier,
  isPaused,
  subscription,
  manageSubscription,
  showSubscriptionDialog
} = useBillingContext()
const { showCancelSubscriptionDialog } = useDialogService()

const { showPricingTable } = useSubscriptionDialog()

function handleChangePlan() {
  if (isFreeTier.value) showPricingTable({ reason: 'settings_billing_panel' })
  else showSubscriptionDialog({ reason: 'settings_billing_panel' })
}

// A team (or enterprise) workspace whose plan has lapsed shows the reactivation
// state in place of the live plan header, snapshot, and auto-reload.
const { hasLapsedTeamPlan: isInactive } = useTeamPlan()
const { isResubscribing, handleResubscribe } = useResubscribe()

const { buildDocsUrl, docsPaths } = useExternalLink()
const learnMoreUrl = buildDocsUrl('/get_started/cloud', {
  includeLocale: true
})
const partnerNodesPricingUrl = buildDocsUrl(docsPaths.partnerNodesPricing, {
  includeLocale: true
})

const { userEmail, resolvedUserInfo } = useCurrentUser()
function openSupport() {
  const url = buildSupportUrl({
    userEmail: userEmail.value,
    userId: resolvedUserInfo.value?.id
  })
  window.open(url, '_blank', 'noopener,noreferrer')
}

const canCancelPlan = computed(
  () =>
    isOriginalOwner.value &&
    isActiveSubscription.value &&
    !isTeamPlanCancelled.value &&
    !isFreeTier.value
)

const planMenuEntries = computed<MenuItem[]>(() =>
  canCancelPlan.value
    ? [
        {
          label: t('subscription.cancelPlan'),
          command: () =>
            void showCancelSubscriptionDialog(
              subscription.value?.endDate ?? undefined
            )
        }
      ]
    : []
)

const { plan, topSpenders, recentActivity } = useWorkspaceOverview()

// Enterprise workspaces read "enterprise" in the lapsed copy, not "team".
const inactiveTitle = computed(() =>
  plan.value.name === 'Enterprise'
    ? t('workspacePanel.overview.inactive.titleEnterprise')
    : t('workspacePanel.overview.inactive.title')
)
const inactiveSubtitle = computed(() =>
  plan.value.name === 'Enterprise'
    ? t('workspacePanel.overview.inactive.subtitleEnterprise')
    : t('workspacePanel.overview.inactive.subtitle')
)

const { navigateToPanel } = useSettingsNavigation()

// The credits tile dictates the row height; the snapshot tile fits as many
// user rows as that height allows, keeping "See more" pinned to the bottom.
const snapshotContainer = ref<HTMLElement | null>(null)
const { pageSize: visibleSnapshotRows } = useAutoPageSize(snapshotContainer, 1)

const snapshotView = ref('top')
const snapshotRows = computed(() =>
  (snapshotView.value === 'top'
    ? topSpenders.value
    : recentActivity.value
  ).slice(0, visibleSnapshotRows.value)
)

// Each tab gets its own empty state: a top-spenders leaderboard of all-zeros
// (a fresh billing cycle) is meaningless, and recent activity can simply have
// no events yet. Returns the message to show, or null when the table has rows.
const snapshotEmptyMessage = computed(() => {
  if (snapshotView.value === 'top') {
    return topSpenders.value.some((row) => row.credits > 0)
      ? null
      : t('workspacePanel.overview.snapshot.empty.topSpenders')
  }
  return recentActivity.value.length === 0
    ? t('workspacePanel.overview.snapshot.empty.recentActivity')
    : null
})

// Both snapshot tabs deep-link to the Members panel (sorted by spend or
// recency) until the Activity tab exists.
function handleSeeMore() {
  requestMembersSort(
    snapshotView.value === 'recent' ? 'lastActivity' : 'credits'
  )
  navigateToPanel('workspace-members')
}
</script>
