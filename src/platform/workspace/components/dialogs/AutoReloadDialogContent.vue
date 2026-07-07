<template>
  <div
    class="flex w-132 max-w-full flex-col rounded-2xl border border-border-default bg-base-background"
  >
    <div
      class="flex h-12 items-center justify-between border-b border-border-default px-4"
    >
      <h2 class="m-0 text-sm font-normal text-base-foreground">
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
        <label class="text-sm text-muted-foreground">
          {{ $t('workspacePanel.autoReload.dialog.thresholdLabel') }}
        </label>
        <div :class="fieldClass">
          <i class="icon-[lucide--coins] size-4 shrink-0 text-credit" />
          <input
            v-model="thresholdModel"
            inputmode="numeric"
            class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-sm text-muted-foreground">
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
            v-model="reloadModel"
            inputmode="numeric"
            class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none"
          />
          <span
            class="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
          >
            <template v-if="unit === 'credits'"
              >≈ {{ reloadCostLabel }}</template
            >
            <template v-else>
              ≈
              <i class="icon-[lucide--coins] size-3.5 text-muted-foreground" />
              {{ reloadCreditsLabel }}
            </template>
          </span>
        </div>
        <p v-if="reloadError" class="m-0 text-xs text-red-500">
          {{ reloadError }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-border-default p-4">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-base-foreground">
          {{ $t('workspacePanel.autoReload.dialog.budgetToggleLabel') }}
        </span>
        <span class="flex items-center gap-2 text-sm text-muted-foreground">
          {{
            budgetEnabled
              ? $t('workspacePanel.autoReload.enabled')
              : $t('workspacePanel.autoReload.disabled')
          }}
          <Switch v-model="budgetEnabled" />
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
          v-model="budgetModel"
          :disabled="!budgetEnabled"
          inputmode="numeric"
          :placeholder="budgetPlaceholder"
          class="w-full min-w-0 border-none bg-transparent text-sm text-base-foreground tabular-nums outline-none disabled:cursor-not-allowed"
        />
        <span
          v-if="budgetEnabled && budgetCents > 0"
          class="flex shrink-0 items-center gap-1 text-sm text-muted-foreground tabular-nums"
        >
          <template v-if="unit === 'credits'">≈ {{ budgetUsdLabel }}</template>
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
import { computed, ref } from 'vue'
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
import { useDialogStore } from '@/stores/dialogStore'
import { cn } from '@comfyorg/tailwind-utils'

const { t, n: fmtNumber } = useI18n()
const dialogStore = useDialogStore()
const { config, save } = useAutoReload()

type Unit = 'credits' | 'usd'
const unitOptions: Unit[] = ['credits', 'usd']
const unit = ref<Unit>('credits')

// reka's single ToggleGroup can emit '' on re-click (deselect); ignore that so a
// unit always stays selected.
function onUnitChange(value: unknown) {
  if (value === 'credits' || value === 'usd') unit.value = value
}

const thresholdCredits = ref(config.thresholdCredits || 1000)
const reloadCredits = ref(config.reloadCredits || 5000)
const budgetEnabled = ref(config.monthlyBudgetCents != null)
const budgetCents = ref(config.monthlyBudgetCents ?? 0)

const fieldClass =
  'flex items-center gap-2 rounded-lg bg-secondary-background px-3 py-2.5'

const fmtInt = (value: number) => fmtNumber(value, { maximumFractionDigits: 0 })
const fmtUsd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
const parseNum = (raw: string) => {
  const parsed = Number(raw.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

// A 0 value renders as an empty field (not "0") so backspacing clears it.
const thresholdModel = computed({
  get: () =>
    thresholdCredits.value === 0 ? '' : fmtInt(thresholdCredits.value),
  set: (value) => (thresholdCredits.value = Math.round(parseNum(value)))
})

const reloadModel = computed({
  get: () => {
    if (reloadCredits.value === 0) return ''
    return unit.value === 'credits'
      ? fmtInt(reloadCredits.value)
      : fmtInt(creditsToUsd(reloadCredits.value))
  },
  set: (value) => {
    const parsed = parseNum(value)
    reloadCredits.value =
      unit.value === 'credits' ? Math.round(parsed) : usdToCredits(parsed)
  }
})
const reloadCostLabel = computed(() =>
  fmtUsd(creditsToCents(reloadCredits.value))
)
const reloadCreditsLabel = computed(() => fmtInt(reloadCredits.value))

const budgetModel = computed({
  get: () => {
    if (budgetCents.value === 0) return ''
    return unit.value === 'credits'
      ? fmtInt(centsToCredits(budgetCents.value))
      : fmtInt(Math.round(budgetCents.value / 100))
  },
  set: (value) => {
    const parsed = parseNum(value)
    budgetCents.value =
      unit.value === 'credits'
        ? creditsToCents(Math.round(parsed))
        : usdToCents(parsed)
  }
})
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

// The reload amount must be worth at least $5 (its credit equivalent).
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
