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
        <div :class="fieldClass">
          <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
          <input
            id="auto-reload-threshold"
            :value="thresholdModel"
            inputmode="numeric"
            class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
            @input="onThresholdInput"
            @blur="formatThresholdModel"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="auto-reload-amount" class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.dialog.amountLabel') }}
        </label>
        <div
          :class="cn(fieldClass, reloadBelowMinimum && 'ring-1 ring-red-500')"
        >
          <i
            v-if="unit === 'credits'"
            class="icon-[lucide--coins] size-4 shrink-0 text-credit"
          />
          <span v-else class="shrink-0 text-sm text-muted-foreground">$</span>
          <input
            id="auto-reload-amount"
            :value="reloadModel"
            inputmode="numeric"
            :aria-invalid="reloadBelowMinimum"
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
      <div :class="cn(fieldClass, !budgetEnabled && 'opacity-50')">
        <i
          v-if="unit === 'credits'"
          class="icon-[lucide--coins] size-4 shrink-0 text-credit"
        />
        <span v-else class="shrink-0 text-sm text-muted-foreground">$</span>
        <input
          :value="budgetModel"
          :disabled="!budgetEnabled"
          aria-labelledby="auto-reload-budget-label"
          inputmode="numeric"
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
        v-if="budgetEnabled && budgetCents > 0"
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
        <Button variant="muted-textonly" @click="onClose">
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
import { useAutoReload } from '@/platform/workspace/composables/useAutoReload'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'
import { storeToRefs } from 'pinia'

const { t, n: fmtNumber, locale } = useI18n()
const dialogStore = useDialogStore()
const { config, save, scopeToWorkspace } = useAutoReload()
const { activeWorkspaceId } = storeToRefs(useTeamWorkspaceStore())
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

function parseNum(raw: string) {
  const numberFormat = new Intl.NumberFormat(locale.value)
  const parts = numberFormat.formatToParts(12_345.6)
  const group = parts.find((part) => part.type === 'group')?.value
  const decimal = parts.find((part) => part.type === 'decimal')?.value
  let normalized = raw
  const digitFormat = new Intl.NumberFormat(locale.value, {
    useGrouping: false
  })
  for (let digit = 0; digit <= 9; digit++) {
    normalized = normalized.split(digitFormat.format(digit)).join(String(digit))
  }
  if (group) normalized = normalized.split(group).join('')
  if (decimal && decimal !== '.') normalized = normalized.replace(decimal, '.')

  const parsed = Number(normalized.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
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

function inputValue(event: Event) {
  return (event.target as HTMLInputElement).value
}

function onThresholdInput(event: Event) {
  thresholdModel.value = inputValue(event)
  thresholdCredits.value = Math.round(parseNum(thresholdModel.value))
}

function onReloadInput(event: Event) {
  reloadModel.value = inputValue(event)
  const parsed = parseNum(reloadModel.value)
  reloadCredits.value =
    unit.value === 'credits' ? Math.round(parsed) : usdToCredits(parsed)
}

function onBudgetInput(event: Event) {
  budgetModel.value = inputValue(event)
  const parsed = parseNum(budgetModel.value)
  budgetCents.value =
    unit.value === 'credits'
      ? creditsToCents(Math.round(parsed))
      : usdToCents(parsed)
}

function onUnitChange(value: unknown) {
  if (value !== 'credits' && value !== 'usd') return
  if (value === unit.value) return

  unit.value = value
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
  thresholdModel.value =
    thresholdCredits.value === 0 ? '' : fmtInt(thresholdCredits.value)
}

function formatReloadModel() {
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

const allowsReloadsLabel = computed(() => {
  const reloads =
    reloadCredits.value > 0
      ? Math.floor(centsToCredits(budgetCents.value) / reloadCredits.value)
      : 0
  return t('workspacePanel.autoReload.dialog.allowsReloads', reloads)
})

const MIN_RELOAD_CENTS = 500
const MIN_RELOAD_CREDITS = usdToCredits(5)

const reloadBelowMinimum = computed(
  () => reloadCredits.value > 0 && reloadCredits.value < MIN_RELOAD_CREDITS
)
const reloadError = computed(() => {
  if (!reloadBelowMinimum.value) return ''
  const amount =
    unit.value === 'credits'
      ? fmtInt(MIN_RELOAD_CREDITS)
      : fmtUsd(MIN_RELOAD_CENTS)
  return t('workspacePanel.autoReload.dialog.minReload', { amount })
})

const canUpdate = computed(
  () =>
    thresholdCredits.value > 0 &&
    reloadCredits.value >= MIN_RELOAD_CREDITS &&
    (!budgetEnabled.value || budgetCents.value > 0)
)

function onClose() {
  dialogStore.closeDialog({ key: 'auto-reload' })
}

watch(activeWorkspaceId, (workspaceId) => {
  scopeToWorkspace(workspaceId)
  onClose()
})

function onUpdate() {
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
