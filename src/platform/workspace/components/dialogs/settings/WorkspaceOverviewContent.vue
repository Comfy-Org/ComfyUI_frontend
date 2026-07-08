<template>
  <div
    class="flex min-h-0 scrollbar-hide flex-1 flex-col gap-4 overflow-y-auto pb-10"
  >
    <!-- Plan + credits + member snapshot -->
    <div
      class="flex flex-col gap-6 rounded-2xl border border-interface-stroke/60 p-6"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-base-foreground">{{ plan.name }}</span>
          <p
            v-if="canManageBilling"
            class="m-0 flex items-center gap-1.5 text-base font-semibold text-base-foreground"
          >
            <i class="icon-[lucide--coins] size-4 text-credit" />
            {{ plan.monthlyCredits.toLocaleString() }}
            <span class="text-base font-normal text-muted-foreground">
              / {{ $t('workspacePanel.overview.perMonth') }}
            </span>
          </p>
          <span class="text-sm text-muted-foreground">
            {{
              $t('workspacePanel.overview.renewsOn', {
                date: plan.renewalLabel
              })
            }}
          </span>
        </div>
        <div v-if="canManageBilling" class="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="lg">
            {{ $t('workspacePanel.overview.managePayment') }}
          </Button>
          <Button v-if="isOriginalOwner" variant="secondary" size="lg">
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

      <div class="grid grid-cols-2 gap-4">
        <CreditsTile class="border-0" />

        <!-- Member snapshot tile -->
        <div
          v-if="canManageBilling"
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
            v-if="showSnapshotEmpty"
            class="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center"
          >
            <i class="icon-[lucide--coins] size-6 text-muted-foreground" />
            <p class="m-0 text-sm text-base-foreground">
              {{ $t('workspacePanel.overview.snapshot.empty.title') }}
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
                  class="hover:bg-transparent [&:nth-child(even)>td]:bg-secondary-background/25 [&>td:first-child]:rounded-l [&>td:last-child]:rounded-r"
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

    <!-- Next month invoice -->
    <div
      v-if="canManageBilling"
      class="flex items-center justify-between gap-4 rounded-2xl border border-interface-stroke/60 p-6"
    >
      <div class="flex flex-col gap-1">
        <span class="text-sm text-base-foreground">
          {{ $t('workspacePanel.overview.nextInvoice') }}
        </span>
        <p class="m-0 text-2xl font-semibold text-base-foreground">
          {{ formatPrice(nextInvoiceCents) }}
          <span class="text-base font-normal text-muted-foreground">
            {{ $t('workspacePanel.overview.usd') }}
          </span>
        </p>
      </div>
      <Button
        variant="secondary"
        size="lg"
        @click="emit('navigate', 'invoices')"
      >
        {{ $t('workspacePanel.planCredits.tabs.invoices') }}
      </Button>
    </div>

    <!-- Credit auto-reload -->
    <AutoReloadSection v-if="canManageBilling" />

    <!-- Footer links: mt-auto floats them to the bottom when the content is
    short (e.g. a member's near-empty tab); when content overflows, mt-auto
    collapses and they scroll below it. -->
    <div
      class="mt-auto flex h-8 shrink-0 items-center gap-4 text-sm text-muted-foreground"
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
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import AutoReloadSection from '@/platform/workspace/components/dialogs/settings/AutoReloadSection.vue'
import { buildSupportUrl } from '@/platform/support/config'
import { useAutoPageSize } from '@/platform/workspace/composables/useAutoPageSize'
import { requestMembersSort } from '@/platform/workspace/composables/useMembersPanel'
import { useWorkspaceOverview } from '@/platform/workspace/composables/useWorkspaceOverview'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useDialogService } from '@/services/dialogService'

const emit = defineEmits<{ navigate: [view: 'activity' | 'invoices'] }>()

const { t, n } = useI18n()

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
const { isFreeTier, subscription } = useBillingContext()
const { showCancelSubscriptionDialog } = useDialogService()

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

const { plan, nextInvoiceCents, topSpenders, recentActivity } =
  useWorkspaceOverview()

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

// A top-spenders leaderboard of all-zeros (a fresh billing cycle) is
// meaningless, so swap in an empty state. Recent activity persists across
// cycles, so it keeps its list.
const showSnapshotEmpty = computed(
  () =>
    snapshotView.value === 'top' &&
    !topSpenders.value.some((row) => row.credits > 0)
)

// Top spenders → the Members panel pre-sorted by credit usage; Recent activity
// → the Activity tab.
function handleSeeMore() {
  if (snapshotView.value === 'recent') {
    emit('navigate', 'activity')
    return
  }
  requestMembersSort('credits')
  navigateToPanel('workspace-members')
}

function formatPrice(cents: number): string {
  return n(cents / 100, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  })
}
</script>
