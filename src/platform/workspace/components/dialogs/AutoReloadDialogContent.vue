<template>
  <div
    class="flex w-132 max-w-full flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 id="auto-reload" class="m-0 text-sm font-normal text-base-foreground">
        {{ $t('workspacePanel.autoReload.dialog.title') }}
      </h2>
      <button
        class="cursor-pointer rounded-sm border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
        :aria-label="$t('g.close')"
        @click="onClose"
      >
        <i class="pi pi-times size-4" />
      </button>
    </div>

    <div class="flex flex-col gap-4 p-4">
      <div class="flex flex-col gap-2">
        <label
          for="auto-reload-threshold"
          class="text-sm text-muted-foreground"
        >
          {{ $t('workspacePanel.autoReload.dialog.thresholdLabel') }}
        </label>
        <AutoReloadAmountField
          input-id="auto-reload-threshold"
          error-id="auto-reload-threshold-error"
          currency="credits"
          :value="thresholdModel"
          :usd-symbol="usdSymbol"
          :error="thresholdError"
          @input="onThresholdInput"
          @blur="formatThresholdModel"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="auto-reload-amount" class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.dialog.amountLabel') }}
        </label>
        <AutoReloadAmountField
          input-id="auto-reload-amount"
          error-id="auto-reload-amount-error"
          :currency="unit"
          :value="reloadModel"
          :usd-symbol="usdSymbol"
          :approx-label="reloadApproxLabel"
          :error="reloadError"
          @input="onReloadInput"
          @blur="formatReloadModel"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-border-default p-4">
      <div class="flex items-center justify-between">
        <span
          id="auto-reload-budget-label"
          class="text-sm font-medium text-base-foreground"
        >
          {{ $t('workspacePanel.autoReload.dialog.budgetToggleLabel') }}
        </span>
        <span class="flex items-center gap-2 text-sm text-muted-foreground">
          {{
            budgetEnabled
              ? $t('workspacePanel.autoReload.enabled')
              : $t('workspacePanel.autoReload.disabled')
          }}
          <Switch
            v-model="budgetEnabled"
            aria-labelledby="auto-reload-budget-label"
          />
        </span>
      </div>
      <p class="m-0 text-sm text-muted-foreground">
        {{ $t('workspacePanel.autoReload.dialog.budgetToggleHint') }}
      </p>
      <AutoReloadAmountField
        labelledby="auto-reload-budget-label"
        error-id="auto-reload-budget-error"
        :currency="unit"
        :value="budgetModel"
        :usd-symbol="usdSymbol"
        :approx-label="budgetApproxLabel"
        :error="budgetError"
        :warning-id="budgetWarning ? 'auto-reload-budget-warning' : undefined"
        :placeholder="budgetPlaceholder"
        :disabled="!budgetEnabled"
        @input="onBudgetInput"
        @blur="formatBudgetModel"
      />
      <p
        v-if="budgetWarning"
        id="auto-reload-budget-warning"
        role="status"
        class="m-0 text-xs text-warning-background"
      >
        {{ budgetWarning }}
      </p>
      <p
        v-else-if="budgetApproxLabel"
        class="m-0 text-xs text-muted-foreground"
      >
        {{ allowsReloadsLabel }}
      </p>
    </div>

    <div
      class="flex items-center justify-between border-t border-border-default p-4"
    >
      <ToggleGroup
        type="single"
        :model-value="unit"
        class="rounded-lg bg-secondary-background p-0.5"
        :aria-label="$t('workspacePanel.autoReload.dialog.unitLabel')"
        @update:model-value="onUnitChange"
      >
        <ToggleGroupItem
          v-for="option in unitOptions"
          :key="option"
          :value="option"
          size="lg"
        >
          {{ $t(`workspacePanel.autoReload.dialog.${option}`) }}
        </ToggleGroupItem>
      </ToggleGroup>
      <div class="flex items-center gap-4">
        <Button variant="muted-textonly" size="lg" @click="onClose">
          {{ $t('workspacePanel.autoReload.dialog.cancel') }}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          :disabled="!canUpdate"
          @click="onUpdate"
        >
          {{ $t('workspacePanel.autoReload.dialog.update') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  creditsToCents,
  creditsToUsd,
  usdToCents,
  usdToCredits
} from '@/base/credits/comfyCredits'
import Button from '@/components/ui/button/Button.vue'
import Switch from '@/components/ui/switch/Switch.vue'
import ToggleGroup from '@/components/ui/toggle-group/ToggleGroup.vue'
import ToggleGroupItem from '@/components/ui/toggle-group/ToggleGroupItem.vue'
import {
  getAffordableReloadCount,
  useAutoReload
} from '@/platform/workspace/composables/useAutoReload'
import AutoReloadAmountField from '@/platform/workspace/components/dialogs/AutoReloadAmountField.vue'
import { parseAmountInput } from '@/platform/workspace/components/dialogs/autoReloadNumberInput'
import { useAutoReloadAccess } from '@/platform/workspace/composables/useAutoReloadAccess'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { storeToRefs } from 'pinia'

const { t, n: fmtNumber, locale } = useI18n()
const { workspaceId } = defineProps<{ workspaceId: string | null }>()
const dialogStore = useDialogStore()
const { config, save, scopeToWorkspace } = useAutoReload()
const { activeWorkspaceId } = storeToRefs(useTeamWorkspaceStore())
const { canConfigure } = useAutoReloadAccess()
const canConfigureWorkspace = computed(
  () => canConfigure.value && activeWorkspaceId.value === workspaceId
)
scopeToWorkspace(activeWorkspaceId.value)

type Unit = 'credits' | 'usd'
const unitOptions: Unit[] = ['credits', 'usd']
const unit = ref<Unit>('credits')
const budgetEnabled = ref(config.monthlyBudgetCents != null)
const thresholdCredits = ref(config.thresholdCredits)
const reloadCredits = ref(config.reloadCredits)
const budgetCents = ref(config.monthlyBudgetCents ?? 0)

function fmtInt(value: number) {
  return fmtNumber(value, { maximumFractionDigits: 0 })
}

function fmtUsd(cents: number) {
  return fmtNumber(cents / 100, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

const thresholdModel = ref(
  thresholdCredits.value === 0 ? '' : fmtInt(thresholdCredits.value)
)
const reloadModel = ref(
  reloadCredits.value === 0 ? '' : fmtInt(reloadCredits.value)
)
const budgetModel = ref(
  budgetCents.value === 0 ? '' : fmtInt(centsToCredits(budgetCents.value))
)
const thresholdInputInvalid = ref(false)
const reloadInputInvalid = ref(false)
const budgetInputInvalid = ref(false)

function inputValue(event: Event) {
  return (event.target as HTMLInputElement).value
}

function onThresholdInput(event: Event) {
  thresholdModel.value = inputValue(event)
  const parsed = parseAmountInput(
    thresholdModel.value,
    locale.value,
    (value) => value
  )
  thresholdCredits.value = parsed.value
  thresholdInputInvalid.value = parsed.invalid
}

function onReloadInput(event: Event) {
  reloadModel.value = inputValue(event)
  const parsed = parseAmountInput(reloadModel.value, locale.value, (value) =>
    unit.value === 'credits' ? value : usdToCredits(value)
  )
  reloadCredits.value = parsed.value
  reloadInputInvalid.value = parsed.invalid
}

function onBudgetInput(event: Event) {
  budgetModel.value = inputValue(event)
  const parsed = parseAmountInput(budgetModel.value, locale.value, (value) =>
    unit.value === 'credits' ? creditsToCents(value) : usdToCents(value)
  )
  budgetCents.value = parsed.value
  budgetInputInvalid.value = parsed.invalid
}

function onUnitChange(value: unknown) {
  if (value !== 'credits' && value !== 'usd') return
  if (value === unit.value) return

  unit.value = value
  reloadInputInvalid.value = false
  budgetInputInvalid.value = false
  reloadModel.value =
    reloadCredits.value === 0
      ? ''
      : value === 'credits'
        ? fmtInt(reloadCredits.value)
        : fmtInt(creditsToUsd(reloadCredits.value))
  budgetModel.value =
    budgetCents.value === 0
      ? ''
      : value === 'credits'
        ? fmtInt(centsToCredits(budgetCents.value))
        : fmtInt(Math.round(budgetCents.value / 100))
}

function formatThresholdModel() {
  if (thresholdInputInvalid.value) return
  thresholdModel.value =
    thresholdCredits.value === 0 ? '' : fmtInt(thresholdCredits.value)
}

function formatReloadModel() {
  if (reloadInputInvalid.value) return
  if (reloadCredits.value === 0) {
    reloadModel.value = ''
    return
  }
  reloadModel.value =
    unit.value === 'credits'
      ? fmtInt(reloadCredits.value)
      : fmtInt(creditsToUsd(reloadCredits.value))
}

function formatBudgetModel() {
  if (budgetInputInvalid.value) return
  if (budgetCents.value === 0) {
    budgetModel.value = ''
    return
  }
  budgetModel.value =
    unit.value === 'credits'
      ? fmtInt(centsToCredits(budgetCents.value))
      : fmtInt(Math.round(budgetCents.value / 100))
}

const reloadApproxLabel = computed(() =>
  unit.value === 'credits'
    ? fmtUsd(creditsToCents(reloadCredits.value))
    : fmtInt(reloadCredits.value)
)
const budgetApproxLabel = computed(() => {
  if (!budgetEnabled.value || budgetCents.value <= 0) return ''
  return unit.value === 'credits'
    ? fmtUsd(budgetCents.value)
    : fmtInt(centsToCredits(budgetCents.value))
})
const budgetPlaceholder = computed(() =>
  unit.value === 'credits'
    ? t('workspacePanel.autoReload.dialog.budgetPlaceholderCredits')
    : t('workspacePanel.autoReload.dialog.budgetPlaceholderUsd')
)
const usdSymbol = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      style: 'currency',
      currency: 'USD'
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ??
    t('workspacePanel.autoReload.dialog.usd')
)

const allowsReloadsLabel = computed(() => {
  const reloads = getAffordableReloadCount(
    budgetCents.value,
    reloadCredits.value
  )
  return t('workspacePanel.autoReload.dialog.allowsReloads', reloads)
})

const MIN_RELOAD_CENTS = 500
const MIN_RELOAD_CREDITS = usdToCredits(5)

const reloadBelowMinimum = computed(
  () => reloadCredits.value < MIN_RELOAD_CREDITS
)
const reloadError = computed(() => {
  if (reloadInputInvalid.value) {
    return t('workspacePanel.autoReload.dialog.wholeNumberRequired')
  }
  if (!reloadBelowMinimum.value) return ''
  const amount =
    unit.value === 'credits'
      ? fmtInt(MIN_RELOAD_CREDITS)
      : fmtUsd(MIN_RELOAD_CENTS)
  return t('workspacePanel.autoReload.dialog.minReload', { amount })
})
const thresholdError = computed(() => {
  if (thresholdInputInvalid.value) {
    return t('workspacePanel.autoReload.dialog.wholeNumberRequired')
  }
  return thresholdCredits.value > 0
    ? ''
    : t('workspacePanel.autoReload.dialog.thresholdRequired')
})
const budgetError = computed(() => {
  if (!budgetEnabled.value) return ''
  if (budgetInputInvalid.value) {
    return t('workspacePanel.autoReload.dialog.wholeNumberRequired')
  }
  return budgetCents.value <= 0
    ? t('workspacePanel.autoReload.dialog.budgetRequired')
    : ''
})
const budgetWarning = computed(() => {
  if (!budgetEnabled.value || budgetError.value) return ''
  return getAffordableReloadCount(budgetCents.value, reloadCredits.value) === 0
    ? t('workspacePanel.autoReload.dialog.budgetBelowReload')
    : ''
})

const canUpdate = computed(
  () => !thresholdError.value && !reloadError.value && !budgetError.value
)

function onClose() {
  dialogStore.closeDialog({ key: 'auto-reload' })
}

watch(activeWorkspaceId, (workspaceId) => {
  scopeToWorkspace(workspaceId)
  onClose()
})

watch(
  canConfigureWorkspace,
  (allowed) => {
    if (!allowed) onClose()
  },
  { immediate: true }
)

function onUpdate() {
  if (!canConfigureWorkspace.value) {
    onClose()
    return
  }
  if (!canUpdate.value) return
  save({
    thresholdCredits: thresholdCredits.value,
    reloadCredits: reloadCredits.value,
    monthlyBudgetCents:
      budgetEnabled.value && budgetCents.value > 0 ? budgetCents.value : null
  })
  onClose()
}
</script>
