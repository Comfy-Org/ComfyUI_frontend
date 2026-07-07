<template>
  <div
    class="flex min-h-0 scrollbar-hide flex-1 flex-col gap-4 overflow-y-auto"
  >
    <!-- Plan + credits + member snapshot -->
    <div
      class="flex flex-col gap-6 rounded-2xl border border-interface-stroke/60 p-6"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-base-foreground">{{ plan.name }}</span>
          <p class="m-0 text-2xl font-semibold text-base-foreground">
            {{ formatPrice(plan.priceCents) }}
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
        <div class="flex shrink-0 items-center gap-2">
          <Button variant="secondary" size="lg">
            {{ $t('workspacePanel.overview.managePayment') }}
          </Button>
          <Button variant="secondary" size="lg">
            {{ $t('workspacePanel.overview.changePlan') }}
          </Button>
          <Button
            variant="secondary"
            size="icon-lg"
            class="rounded-lg"
            :aria-label="$t('g.moreOptions')"
          >
            <i class="pi pi-ellipsis-h" />
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <!-- Credits tile -->
        <div
          class="flex flex-col gap-4 rounded-xl bg-modal-panel-background p-4"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">
              {{ $t('workspacePanel.overview.totalCredits') }}
            </span>
            <i class="icon-[lucide--refresh-cw] size-4 text-muted-foreground" />
          </div>
          <div class="flex items-baseline gap-2">
            <i class="icon-[lucide--coins] size-5 text-warning-background" />
            <span
              class="text-3xl font-semibold text-base-foreground tabular-nums"
            >
              {{ credits.remaining.toLocaleString() }}
            </span>
            <span class="text-sm text-muted-foreground">
              {{ $t('workspacePanel.overview.remaining') }}
            </span>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">
                {{ $t('workspacePanel.overview.monthly') }}
              </span>
              <span class="text-muted-foreground">
                {{
                  $t('workspacePanel.overview.refills', {
                    date: credits.refillLabel
                  })
                }}
              </span>
            </div>
            <ProgressBar :value="monthlyProgress" />
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground tabular-nums">
                {{
                  $t('workspacePanel.overview.used', {
                    count: credits.monthlyUsed.toLocaleString()
                  })
                }}
              </span>
              <span
                class="flex items-center gap-1 text-base-foreground tabular-nums"
              >
                <i
                  class="icon-[lucide--coins] size-4 text-warning-background"
                />
                {{
                  $t('workspacePanel.overview.leftOf', {
                    left: monthlyLeft.toLocaleString(),
                    total: credits.monthlyTotal.toLocaleString()
                  })
                }}
              </span>
            </div>
          </div>

          <div class="h-px w-full bg-interface-stroke/60" />

          <div class="flex items-start justify-between">
            <div class="flex flex-col gap-0.5">
              <span
                class="flex items-center gap-1 text-sm text-muted-foreground"
              >
                {{ $t('workspacePanel.overview.additionalCredits') }}
                <i class="icon-[lucide--info] size-3.5" />
              </span>
              <span class="text-sm text-muted-foreground">
                {{ $t('workspacePanel.overview.usedAfterMonthly') }}
              </span>
            </div>
            <span
              class="flex items-center gap-1 text-sm text-base-foreground tabular-nums"
            >
              <i class="icon-[lucide--coins] size-4 text-warning-background" />
              {{ credits.additional.toLocaleString() }}
            </span>
          </div>

          <Button variant="secondary" size="lg" class="w-full">
            {{ $t('workspacePanel.overview.addCredits') }}
          </Button>
        </div>

        <!-- Member snapshot tile -->
        <div
          class="flex flex-col gap-3 rounded-xl bg-modal-panel-background p-4"
        >
          <div class="flex items-center gap-4">
            <button
              v-for="tab in snapshotTabs"
              :key="tab.key"
              :class="
                cn(
                  'border-none bg-transparent p-0 text-sm',
                  snapshotView === tab.key
                    ? 'text-base-foreground'
                    : 'cursor-pointer text-muted-foreground'
                )
              "
              @click="snapshotView = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <div
            class="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 text-sm text-muted-foreground"
          >
            <span>{{ $t('workspacePanel.overview.snapshot.user') }}</span>
            <span>{{
              $t('workspacePanel.overview.snapshot.lastActivity')
            }}</span>
            <span class="flex items-center gap-1 justify-self-end">
              <i class="icon-[lucide--coins] size-4" />
              {{ $t('workspacePanel.overview.snapshot.creditsUsed') }}
            </span>
            <template v-for="row in snapshotRows" :key="row.userName">
              <span class="flex items-center gap-2 py-1 text-base-foreground">
                <span
                  class="flex size-5 shrink-0 items-center justify-center rounded-full"
                  :style="{ backgroundColor: row.color }"
                >
                  <span class="text-2xs font-bold text-base-foreground">
                    {{ row.userName.charAt(0).toUpperCase() }}
                  </span>
                </span>
                {{ row.userName }}
              </span>
              <span class="text-muted-foreground tabular-nums">
                {{ row.lastActivity }}
              </span>
              <span class="justify-self-end text-base-foreground tabular-nums">
                {{ row.credits.toLocaleString() }}
              </span>
            </template>
          </div>

          <Button
            variant="secondary"
            size="lg"
            class="mt-auto w-full"
            @click="emit('navigate', 'activity')"
          >
            {{ $t('workspacePanel.overview.seeMore') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Next month invoice -->
    <div
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

    <!-- Footer links -->
    <div
      class="flex h-8 shrink-0 items-center gap-6 text-sm text-muted-foreground"
    >
      <span class="flex items-center gap-1">
        <i class="icon-[lucide--circle-help] size-4" />
        {{ $t('workspacePanel.overview.learnMore') }}
      </span>
      <span class="flex items-center gap-1">
        <i class="icon-[lucide--circle-help] size-4" />
        {{ $t('workspacePanel.overview.pricingTable') }}
      </span>
      <span class="flex items-center gap-1">
        <i class="icon-[lucide--message-circle] size-4" />
        {{ $t('workspacePanel.overview.messageSupport') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import ProgressBar from '@/platform/workspace/components/dialogs/settings/ProgressBar.vue'
import { useWorkspaceOverview } from '@/platform/workspace/composables/useWorkspaceOverview'
import { cn } from '@comfyorg/tailwind-utils'

const emit = defineEmits<{ navigate: [view: 'activity' | 'invoices'] }>()

const { t } = useI18n()

const {
  plan,
  credits,
  monthlyLeft,
  monthlyProgress,
  nextInvoiceCents,
  topSpenders,
  recentActivity
} = useWorkspaceOverview()

type SnapshotView = 'top' | 'recent'
const snapshotView = ref<SnapshotView>('top')
const snapshotTabs = computed(() => [
  {
    key: 'top' as const,
    label: t('workspacePanel.overview.snapshot.topSpenders')
  },
  {
    key: 'recent' as const,
    label: t('workspacePanel.overview.snapshot.recentActivity')
  }
])
const snapshotRows = computed(() =>
  snapshotView.value === 'top' ? topSpenders : recentActivity
)

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  })
}
</script>
