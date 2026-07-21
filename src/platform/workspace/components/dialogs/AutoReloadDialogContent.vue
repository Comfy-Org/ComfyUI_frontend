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
        <div :class="cn(fieldClass, thresholdError && 'ring-1 ring-red-500')">
          <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
          <input
            id="auto-reload-threshold"
            :value="thresholdModel"
            inputmode="numeric"
            :aria-invalid="!!thresholdError"
            :aria-describedby="
              thresholdError ? 'auto-reload-threshold-error' : undefined
            "
            class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
            @input="onThresholdInput"
            @blur="formatThresholdModel"
          />
        </div>
        <p
          v-if="thresholdError"
          id="auto-reload-threshold-error"
          class="m-0 text-xs text-red-500"
        >
          {{ thresholdError }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label for="auto-reload-amount" class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.dialog.amountLabel') }}
        </label>
        <div :class="cn(fieldClass, reloadError && 'ring-1 ring-red-500')">
          <i
            v-if="unit === 'credits'"
            class="icon-[lucide--coins] size-4 shrink-0 text-credit"
          />
          <span v-else class="shrink-0 text-sm text-muted-foreground">
            {{ usdSymbol }}
          </span>
          <input
            id="auto-reload-amount"
            :value="reloadModel"
            inputmode="numeric"
            :aria-invalid="!!reloadError"
            :aria-describedby="
              reloadError ? 'auto-reload-amount-error' : undefined
            "
            class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
            @input="onReloadInput"
            @blur="formatReloadModel"
          />
          <span
            class="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
          >
            <template v-if="unit === 'credits'">
              ≈ {{ reloadCostLabel }}
            </template>
            <template v-else>
              ≈
              <i class="icon-[lucide--coins] size-3.5 text-muted-foreground" />
              {{ reloadCreditsLabel }}
            </template>
          </span>
        </div>
        <p
          v-if="reloadError"
          id="auto-reload-amount-error"
          class="m-0 text-xs text-red-500"
        >
          {{ reloadError }}
        </p>
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
      <div
        :class="
          cn(
            fieldClass,
            !budgetEnabled && 'opacity-50',
            budgetError && 'ring-1 ring-red-500'
          )
        "
      >
        <i
          v-if="unit === 'credits'"
          class="icon-[lucide--coins] size-4 shrink-0 text-credit"
        />
        <span v-else class="shrink-0 text-sm text-muted-foreground">
          {{ usdSymbol }}
        </span>
        <input
          :value="budgetModel"
          :disabled="!budgetEnabled"
          aria-labelledby="auto-reload-budget-label"
          inputmode="numeric"
          :aria-invalid="!!budgetError"
          :aria-describedby="
            budgetError
              ? 'auto-reload-budget-error'
              : budgetWarning
                ? 'auto-reload-budget-warning'
                : undefined
          "
          :placeholder="budgetPlaceholder"
          class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none disabled:cursor-not-allowed"
          @input="onBudgetInput"
          @blur="formatBudgetModel"
        />
        <span
          v-if="budgetEnabled && budgetCents > 0"
          class="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
        >
          <template v-if="unit === 'credits'">
            ≈ {{ budgetUsdLabel }}
          </template>
          <template v-else>
            ≈
            <i class="icon-[lucide--coins] size-3.5 text-muted-foreground" />
            {{ budgetCreditsLabel }}
          </template>
        </span>
      </div>
      <p
        v-if="budgetWarning"
        id="auto-reload-budget-warning"
        role="status"
        class="m-0 flex items-center gap-1.5 text-xs text-warning-background"
      >
        <i
          class="icon-[lucide--triangle-alert] size-3.5 shrink-0"
          aria-hidden="true"
        />
        {{ budgetWarning }}
      </p>
      <p
        v-else-if="budgetEnabled && budgetCents > 0"
        class="m-0 text-xs text-muted-foreground"
      >
        {{ allowsReloadsLabel }}
      </p>
      <p
        v-if="budgetError"
        id="auto-reload-budget-error"
        class="m-0 text-xs text-red-500"
      >
        {{ budgetError }}
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
import { useAutoReloadAccess } from '@/platform/workspace/composables/useAutoReloadAccess'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'
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

const fieldClass =
  'flex items-center gap-2 rounded-lg bg-secondary-background px-3 py-2.5'

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

function normalizeLocaleDigits(raw: string) {
  let normalized = raw
  const digitFormat = new Intl.NumberFormat(locale.value, {
    useGrouping: false
  })
  for (let digit = 0; digit <= 9; digit++) {
    normalized = normalized.split(digitFormat.format(digit)).join(String(digit))
  }
  return normalized
}

function parseWholeNumber(raw: string) {
  const trimmed = raw.trim()
  if (trimmed === '') return { value: 0, invalid: false }

  const numberFormat = new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 0
  })
  const group = numberFormat
    .formatToParts(12_345)
    .find((part) => part.type === 'group')?.value
  const localized = normalizeLocaleDigits(trimmed)
  const ungrouped = group ? localized.split(group).join('') : localized

  if (!/^\d+$/.test(ungrouped)) return { value: 0, invalid: true }

  const value = Number(ungrouped)
  if (!Number.isSafeInteger(value)) return { value: 0, invalid: true }

  if (group && localized.includes(group)) {
    const canonicalGrouped = normalizeLocaleDigits(numberFormat.format(value))
    if (canonicalGrouped !== localized) return { value: 0, invalid: true }
  }

  return { value, invalid: false }
}

function normalizeInput(raw: string, convert: (value: number) => number) {
  const parsed = parseWholeNumber(raw)
  if (parsed.invalid) return parsed

  const value = convert(parsed.value)
  return Number.isSafeInteger(value) && value >= 0
    ? { value, invalid: false }
    : { value: 0, invalid: true }
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
  const parsed = normalizeInput(thresholdModel.value, (value) => value)
  thresholdCredits.value = parsed.value
  thresholdInputInvalid.value = parsed.invalid
}

function onReloadInput(event: Event) {
  reloadModel.value = inputValue(event)
  const parsed = normalizeInput(reloadModel.value, (value) =>
    unit.value === 'credits' ? value : usdToCredits(value)
  )
  reloadCredits.value = parsed.value
  reloadInputInvalid.value = parsed.invalid
}

function onBudgetInput(event: Event) {
  budgetModel.value = inputValue(event)
  const parsed = normalizeInput(budgetModel.value, (value) =>
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

const reloadCostLabel = computed(() =>
  fmtUsd(creditsToCents(reloadCredits.value))
)
const reloadCreditsLabel = computed(() => fmtInt(reloadCredits.value))
const budgetUsdLabel = computed(() => fmtUsd(budgetCents.value))
const budgetCreditsLabel = computed(() =>
  fmtInt(centsToCredits(budgetCents.value))
)
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
