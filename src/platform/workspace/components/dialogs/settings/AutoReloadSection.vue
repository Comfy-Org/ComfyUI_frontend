<template>
  <div
    class="flex flex-col gap-4 rounded-2xl border border-interface-stroke/60 p-6"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium text-base-foreground">
          {{ $t('workspacePanel.autoReload.title') }}
        </span>
        <span class="max-w-md text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.subtitle') }}
        </span>
      </div>
      <div v-if="isConfigured" class="flex shrink-0 items-center gap-3">
        <span class="flex items-center gap-2 text-sm text-muted-foreground">
          {{ enabledLabel }}
          <Switch :model-value="isEnabled" @update:model-value="setEnabled" />
        </span>
        <Button variant="secondary" size="lg" @click="openConfig">
          {{ $t('workspacePanel.autoReload.edit') }}
        </Button>
      </div>
    </div>

    <!-- Empty / not-set-up state — same one-column grid as the configured tile
         so both sit at the top tiles' width. -->
    <div v-if="!isConfigured" class="grid grid-cols-2 gap-4">
      <div
        class="flex flex-col gap-3 rounded-xl bg-modal-panel-background px-6 py-5"
      >
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.empty.body') }}
        </p>
        <Button variant="tertiary" size="lg" class="w-full" @click="openConfig">
          {{ $t('workspacePanel.autoReload.empty.cta') }}
        </Button>
      </div>
    </div>

    <!-- Configured tile — constrained to one column of the same grid the top
         tiles use, so it matches their width (empty second column left open). -->
    <div v-else class="grid grid-cols-2 gap-4">
      <div
        :class="
          cn(
            'flex flex-col gap-4 rounded-xl bg-modal-panel-background px-6 py-5 transition-opacity',
            !isEnabled && 'opacity-50'
          )
        "
      >
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('workspacePanel.autoReload.tile.label') }}
          </span>
          <StatusBadge v-if="badge" :label="badge" severity="secondary" />
        </div>

        <p
          :class="
            cn(
              'm-0 flex items-center gap-1.5 text-sm text-muted-foreground',
              isPaused && 'opacity-50'
            )
          "
        >
          <i class="icon-[lucide--coins] size-4 text-credit" />
          <span class="text-lg font-semibold text-base-foreground tabular-nums">
            {{ reloadCreditsLabel }}
          </span>
          {{ $t('workspacePanel.autoReload.tile.whenBelow') }}
          <span class="font-semibold text-base-foreground tabular-nums">
            {{ thresholdLabel }}
          </span>
        </p>

        <div v-if="hasBudget" class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              {{ $t('workspacePanel.autoReload.tile.monthlyBudget') }}
            </span>
            <span class="text-muted-foreground">{{ resetsLabel }}</span>
          </div>
          <ProgressBar :value="budgetUsedFraction" />
          <div class="flex items-start justify-between text-sm">
            <span class="text-muted-foreground tabular-nums">
              {{ spentLabel }}
            </span>
            <div class="flex flex-col items-end gap-0.5">
              <span class="font-medium text-base-foreground tabular-nums">
                {{ leftLabel }}
              </span>
              <span :class="cn('tabular-nums', reloadsLeftClass)">
                {{ reloadsLeftLabel }}
              </span>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-between border-t border-interface-stroke/60 pt-3 text-sm text-muted-foreground"
        >
          <span class="tabular-nums">{{ recentReloadLabel }}</span>
          <span
            v-if="config.lastReload"
            class="flex items-center gap-1.5 tabular-nums"
          >
            <i class="icon-[lucide--coins] size-4 text-credit" />
            <span class="text-base-foreground">{{
              lastReloadCreditsLabel
            }}</span>
            <span>·</span>
            <span class="text-base-foreground">{{ lastReloadCostLabel }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { creditsToCents } from '@/base/credits/comfyCredits'
import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ProgressBar from '@/platform/workspace/components/dialogs/settings/ProgressBar.vue'
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { t, d, n: fmtNumber } = useI18n()

const {
  config,
  cycleResetDate,
  isConfigured,
  isEnabled,
  hasBudget,
  budgetLeftCents,
  budgetUsedFraction,
  reloadsLeft,
  isPaused,
  isWarning,
  setEnabled
} = useAutoReload()

const { showAutoReloadDialog } = useDialogService()

function openConfig() {
  void showAutoReloadDialog()
}

const fmtCredits = (value: number) =>
  fmtNumber(value, { maximumFractionDigits: 0 })
const fmtUsd = (cents: number) =>
  fmtNumber(cents / 100, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })

const enabledLabel = computed(() =>
  isEnabled.value
    ? t('workspacePanel.autoReload.enabled')
    : t('workspacePanel.autoReload.disabled')
)

const badge = computed(() => {
  if (isPaused.value) return t('workspacePanel.autoReload.badge.paused')
  if (!isEnabled.value) return t('workspacePanel.autoReload.badge.off')
  return ''
})

const reloadCreditsLabel = computed(() => fmtCredits(config.reloadCredits))
const thresholdLabel = computed(() => fmtCredits(config.thresholdCredits))

const resetsLabel = computed(() =>
  t('workspacePanel.autoReload.tile.resets', {
    date: d(cycleResetDate, { month: 'short', day: 'numeric' })
  })
)
const spentLabel = computed(() =>
  t('workspacePanel.autoReload.tile.spent', {
    amount: fmtUsd(config.spentThisCycleCents)
  })
)
const leftLabel = computed(() =>
  t('workspacePanel.autoReload.tile.leftOfBudget', {
    left: fmtUsd(budgetLeftCents.value),
    budget: fmtUsd(config.monthlyBudgetCents ?? 0)
  })
)
const reloadsLeftLabel = computed(() =>
  t('workspacePanel.autoReload.tile.reloadsLeft', reloadsLeft.value ?? 0)
)
const reloadsLeftClass = computed(() =>
  isPaused.value
    ? 'text-danger'
    : isWarning.value
      ? 'text-credit'
      : 'text-muted-foreground'
)

const recentReloadLabel = computed(() =>
  config.lastReload
    ? t('workspacePanel.autoReload.tile.recentReload', {
        date: d(config.lastReload.date, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      })
    : t('workspacePanel.autoReload.tile.noRecentReload')
)
const lastReloadCreditsLabel = computed(() =>
  config.lastReload ? fmtCredits(config.lastReload.credits) : ''
)
const lastReloadCostLabel = computed(() =>
  config.lastReload ? fmtUsd(creditsToCents(config.lastReload.credits)) : ''
)
</script>
