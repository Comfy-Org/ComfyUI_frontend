<template>
  <div
    data-testid="auto-reload-section"
    :inert="frozen || undefined"
    :aria-disabled="frozen"
    :class="
      cn(
        'flex flex-col gap-4 rounded-2xl border border-interface-stroke/60 p-6 transition-opacity',
        frozen && 'pointer-events-none opacity-50'
      )
    "
  >
    <div
      class="flex flex-col gap-4 @4xl:flex-row @4xl:items-start @4xl:justify-between"
    >
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
          <Switch
            :model-value="displayEnabled"
            class="disabled:opacity-100"
            :disabled="frozen"
            :aria-label="$t('workspacePanel.autoReload.toggleLabel')"
            @update:model-value="handleEnabledChange"
          />
        </span>
        <Button
          variant="secondary"
          size="lg"
          class="disabled:opacity-100"
          :disabled="frozen"
          @click="openConfig"
        >
          {{ $t('workspacePanel.autoReload.edit') }}
        </Button>
      </div>
    </div>

    <div v-if="!isConfigured" class="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
      <div
        class="flex flex-col gap-3 rounded-xl bg-modal-panel-background px-6 py-5"
      >
        <p class="m-0 text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.empty.body') }}
        </p>
        <Button
          variant="tertiary"
          size="lg"
          class="w-full disabled:opacity-100"
          :disabled="frozen"
          @click="openConfig"
        >
          {{ $t('workspacePanel.autoReload.empty.cta') }}
        </Button>
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 @4xl:grid-cols-2">
      <div
        :class="
          cn(
            'flex flex-col gap-4 rounded-xl bg-modal-panel-background px-6 py-5 transition-opacity',
            !frozen && !isEnabled && 'opacity-50'
          )
        "
      >
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('workspacePanel.autoReload.tile.label') }}
          </span>
          <StatusBadge v-if="badge" :label="badge" :severity="badgeSeverity" />
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
          <span
            class="text-2xl leading-none font-semibold text-base-foreground tabular-nums"
          >
            {{ reloadCreditsLabel }}
          </span>
          {{ $t('workspacePanel.autoReload.tile.whenBelow') }}
          <span class="font-semibold text-base-foreground tabular-nums">
            {{ thresholdLabel }}
          </span>
        </p>

        <template v-if="hasBudget">
          <div class="h-px w-full bg-interface-stroke" />
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">
                {{ $t('workspacePanel.autoReload.tile.monthlyBudget') }}
              </span>
              <span :class="cn('tabular-nums', percentSpentClass)">
                {{ percentSpentLabel }}
              </span>
            </div>
            <ProgressBar
              :value="budgetUsedFraction"
              :aria-label="$t('workspacePanel.autoReload.tile.monthlyBudget')"
            />
            <span v-if="isWarning" class="sr-only" role="status">
              {{ $t('workspacePanel.autoReload.tile.nearLimitStatus') }}
            </span>
            <div class="flex justify-end text-sm">
              <span class="text-muted-foreground tabular-nums">
                {{ budgetSpentLabel }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onScopeDispose, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import StatusBadge from '@/components/common/StatusBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ProgressBar from '@/platform/workspace/components/dialogs/settings/ProgressBar.vue'
import { useAutoReloadAccess } from '@/platform/workspace/composables/useAutoReloadAccess'
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogService } from '@/services/dialogService'
import { cn } from '@comfyorg/tailwind-utils'

const { frozen = false } = defineProps<{
  frozen?: boolean
}>()

const { t, n: fmtNumber } = useI18n()

const {
  config,
  isConfigured,
  isEnabled,
  hasBudget,
  budgetTotalCents,
  budgetSpentCents,
  budgetUsedFraction,
  isPaused,
  isWarning,
  setEnabled,
  scopeToWorkspace
} = useAutoReload()
const { activeWorkspaceId } = storeToRefs(useTeamWorkspaceStore())
const { canConfigureNow } = useAutoReloadAccess()

scopeToWorkspace(activeWorkspaceId.value)
watch(activeWorkspaceId, scopeToWorkspace)

const displayEnabled = computed(() => !frozen && isEnabled.value)
let isAlive = true
onScopeDispose(() => {
  isAlive = false
})

const { showAutoReloadDialog } = useDialogService()

function openConfig() {
  if (frozen || !canConfigureNow()) return
  const workspaceId = activeWorkspaceId.value
  void showAutoReloadDialog({
    workspaceId,
    canOpen: () =>
      isAlive &&
      activeWorkspaceId.value === workspaceId &&
      canConfigureNow() &&
      !frozen
  })
}

function handleEnabledChange(value: boolean) {
  if (frozen || !canConfigureNow()) return
  setEnabled(value)
}

function fmtCredits(value: number) {
  return fmtNumber(value, { maximumFractionDigits: 0 })
}

function fmtUsd(cents: number) {
  return fmtNumber(cents / 100, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

const enabledLabel = computed(() =>
  displayEnabled.value
    ? t('workspacePanel.autoReload.enabled')
    : t('workspacePanel.autoReload.disabled')
)

const badge = computed(() => {
  if (frozen) return t('workspacePanel.autoReload.badge.off')
  if (isPaused.value) return t('workspacePanel.autoReload.badge.paused')
  if (!isEnabled.value) return t('workspacePanel.autoReload.badge.off')
  return ''
})

const badgeSeverity = computed(() =>
  !frozen && isPaused.value ? 'contrast' : 'secondary'
)

const reloadCreditsLabel = computed(() => fmtCredits(config.reloadCredits))
const thresholdLabel = computed(() => fmtCredits(config.thresholdCredits))

const percentSpentLabel = computed(() =>
  t('workspacePanel.autoReload.tile.percentSpent', {
    percent: Math.round(budgetUsedFraction.value * 100)
  })
)
const percentSpentClass = computed(() =>
  isPaused.value
    ? 'text-danger'
    : isWarning.value
      ? 'text-credit'
      : 'text-muted-foreground'
)
const budgetSpentLabel = computed(() =>
  t('workspacePanel.autoReload.tile.spentOfBudget', {
    spent: fmtUsd(budgetSpentCents.value),
    budget: fmtUsd(budgetTotalCents.value)
  })
)
</script>
