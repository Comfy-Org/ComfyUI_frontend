<template>
  <div
    class="flex w-[416px] flex-col rounded-2xl border border-border-default bg-base-background shadow-[1px_1px_8px_0_rgba(0,0,0,0.4)]"
  >
    <!-- Header -->
    <div class="flex h-12 items-center justify-between px-4">
      <h2 class="text-sm font-bold text-base-foreground">
        {{ $t('credits.topUp.addMoreCredits') }}
      </h2>
      <button
        class="cursor-pointer border-none bg-transparent p-0 text-muted-foreground transition-colors hover:text-base-foreground"
        @click="handleClose"
      >
        <i class="icon-[lucide--x] size-4" />
      </button>
    </div>

    <!-- Preset amount buttons -->
    <div class="flex gap-2 px-4 pt-8 border-t border-muted-background">
      <Button
        v-for="amount in PRESET_AMOUNTS"
        :key="amount"
        variant="secondary"
        size="lg"
        class="h-12 text-sm w-full"
        @click="handlePresetClick(amount)"
      >
        ${{ amount }}
      </Button>
    </div>

    <!-- You pay / You get section -->
    <div class="flex gap-4 px-4 pt-8">
      <!-- You Pay -->
      <div class="flex flex-1 flex-col gap-2">
        <div class="text-xs text-muted-foreground">
          {{ $t('credits.topUp.youPay') }}
        </div>
        <div
          class="w-full flex h-10 items-center rounded-lg bg-component-node-widget-background"
        >
          <button
            class="flex h-full w-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground disabled:opacity-30"
            :disabled="payAmount <= 0"
            @click="handlePayStep(-1)"
          >
            <i class="icon-[lucide--minus] size-4" />
          </button>
          <div
            class="flex flex-1 items-center justify-center gap-0.5 overflow-hidden"
          >
            <span class="shrink-0 text-base font-semibold text-base-foreground"
              >$</span
            >
            <input
              ref="payInputRef"
              v-model="payInputValue"
              type="text"
              inputmode="numeric"
              :style="{ width: `${payInputWidth}ch` }"
              class="min-w-0 border-none bg-transparent text-center text-base font-semibold text-base-foreground outline-none"
              :aria-label="$t('credits.topUp.amountToPayLabel')"
              @input="handlePayInputChange"
              @blur="handlePayInputBlur"
              @focus="handleInputFocus"
            />
          </div>
          <button
            class="flex h-full w-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground disabled:opacity-30"
            :disabled="payAmount >= MAX_AMOUNT"
            @click="handlePayStep(1)"
          >
            <i class="icon-[lucide--plus] size-4" />
          </button>
        </div>
      </div>

      <!-- You Get -->
      <div class="flex flex-1 flex-col gap-2">
        <div class="text-xs text-muted-foreground">
          {{ $t('credits.topUp.youGet') }}
        </div>
        <div
          class="flex h-10 items-center rounded-lg bg-component-node-widget-background"
        >
          <button
            class="flex h-full w-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground disabled:opacity-30"
            :disabled="credits <= 0"
            @click="handleCreditsStep(-1)"
          >
            <i class="icon-[lucide--minus] size-4" />
          </button>
          <div
            class="flex flex-1 items-center justify-center gap-1 overflow-hidden"
          >
            <i class="icon-[lucide--component] size-4 shrink-0 text-gold-500" />
            <input
              ref="creditsInputRef"
              v-model="creditsInputValue"
              type="text"
              inputmode="numeric"
              :style="{ width: `${creditsInputWidth}ch` }"
              class="min-w-0 border-none bg-transparent text-center text-base font-semibold text-base-foreground outline-none"
              :aria-label="$t('credits.topUp.creditsToReceiveLabel')"
              @input="handleCreditsInputChange"
              @blur="handleCreditsInputBlur"
              @focus="handleInputFocus"
            />
          </div>
          <button
            class="flex h-full w-8 cursor-pointer items-center justify-center border-none bg-transparent text-muted-foreground transition-colors hover:text-base-foreground disabled:opacity-30"
            :disabled="payAmount >= MAX_AMOUNT"
            @click="handleCreditsStep(1)"
          >
            <i class="icon-[lucide--plus] size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Warnings -->
    <p v-if="isBelowMin" class="px-4 pt-2 text-sm text-gold-500">
      {{
        $t('credits.topUp.minimumPurchase', {
          amount: MIN_AMOUNT,
          credits: MIN_AMOUNT * CREDITS_PER_DOLLAR
        })
      }}
    </p>
    <p v-if="showCeilingWarning" class="px-4 pt-2 text-sm text-gold-500">
      {{
        $t('credits.topUp.maximumAmount', { amount: formatNumber(MAX_AMOUNT) })
      }}
    </p>

    <!-- Credits per dollar info -->

    <div class="py-6 flex items-center justify-center gap-1">
      <a
        :href="pricingUrl"
        target="_blank"
        class="flex items-center gap-1 text-sm text-muted-foreground no-underline transition-colors hover:text-base-foreground"
      >
        {{ $t('credits.topUp.viewPricing') }}
        <i class="icon-[lucide--external-link] size-4" />
      </a>
    </div>

    <!-- Buy credits button -->
    <Button
      :disabled="!isValidAmount || loading"
      :loading="loading"
      variant="primary"
      size="lg"
      class="mx-4 mb-4 justify-center"
      @click="handleBuy"
    >
      {{ $t('credits.topUp.buyCredits') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import { useTelemetry } from '@/platform/telemetry'
import { useDialogStore } from '@/stores/dialogStore'

const { isInsufficientCredits: _isInsufficientCredits = false } = defineProps<{
  isInsufficientCredits?: boolean
}>()

const { t } = useI18n()
const authActions = useFirebaseAuthActions()
const dialogStore = useDialogStore()
const telemetry = useTelemetry()
const toast = useToast()
const { buildDocsUrl, docsPaths } = useExternalLink()

// Constants
const PRESET_AMOUNTS = [10, 25, 50, 100]
const CREDITS_PER_DOLLAR = 211
const MIN_AMOUNT = 5
const MAX_AMOUNT = 50000

// State
const selectedPreset = ref<number | null>(null)
const payAmount = ref(1000)
const payInputValue = ref(formatNumber(1000))
const creditsInputValue = ref(formatNumber(1000 * CREDITS_PER_DOLLAR))
const showCeilingWarning = ref(false)
const loading = ref(false)

// Refs
const payInputRef = ref<HTMLInputElement | null>(null)
const creditsInputRef = ref<HTMLInputElement | null>(null)

// Computed
const pricingUrl = computed(() =>
  buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true })
)

const credits = computed(() => payAmount.value * CREDITS_PER_DOLLAR)

const isValidAmount = computed(
  () => payAmount.value >= MIN_AMOUNT && payAmount.value <= MAX_AMOUNT
)

const isBelowMin = computed(
  () => payAmount.value < MIN_AMOUNT && payAmount.value > 0
)

const payInputWidth = computed(() =>
  Math.min(Math.max(payInputValue.value.length, 1) + 0.5, 9)
)

const creditsInputWidth = computed(() =>
  Math.min(Math.max(creditsInputValue.value.length, 1) + 0.5, 9)
)

// Watch credits to update input when not focused
watch(credits, (newCredits) => {
  if (document.activeElement !== creditsInputRef.value) {
    creditsInputValue.value = formatNumber(newCredits)
  }
})

// Utility functions
function formatNumber(num: number): string {
  return num.toLocaleString('en-US')
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/[^0-9]/g, '')
  return cleaned === '' ? 0 : parseInt(cleaned, 10)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatWithCursor(
  value: string,
  cursorPos: number
): { formatted: string; newCursor: number } {
  const num = parseFormattedNumber(value)
  const formatted = formatNumber(num)

  // Count how many digits are before the cursor in the original
  const digitsBeforeCursor = value
    .slice(0, cursorPos)
    .replace(/[^0-9]/g, '').length

  // Find the position in the formatted string where we have that many digits
  let digitCount = 0
  let newCursor = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/[0-9]/.test(formatted[i])) {
      digitCount++
    }
    if (digitCount >= digitsBeforeCursor) {
      newCursor = i + 1
      break
    }
  }

  // If we didn't find enough digits, put cursor at end
  if (digitCount < digitsBeforeCursor) {
    newCursor = formatted.length
  }

  return { formatted, newCursor }
}

function getStepAmount(currentAmount: number): number {
  if (currentAmount < 100) return 10
  if (currentAmount < 1000) return 50
  return 100
}

// Event handlers
function updatePayAmount(newAmount: number, fromPreset = false) {
  const clamped = clamp(newAmount, 0, MAX_AMOUNT)
  payAmount.value = clamped
  payInputValue.value = formatNumber(clamped)
  creditsInputValue.value = formatNumber(clamped * CREDITS_PER_DOLLAR)
  selectedPreset.value = fromPreset ? newAmount : null
}

function handlePayInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value
  const cursorPos = input.selectionStart ?? raw.length
  const num = parseFormattedNumber(raw)

  // Clamp to max immediately while typing
  const clamped = Math.min(num, MAX_AMOUNT)
  const wasClamped = num > MAX_AMOUNT

  showCeilingWarning.value = wasClamped
  payAmount.value = clamped
  creditsInputValue.value = formatNumber(clamped * CREDITS_PER_DOLLAR)
  selectedPreset.value = null

  // Format and restore cursor position
  const { formatted, newCursor } = formatWithCursor(
    wasClamped ? formatNumber(clamped) : raw,
    wasClamped ? formatNumber(clamped).length : cursorPos
  )
  payInputValue.value = formatted

  // Restore cursor position after Vue re-render
  requestAnimationFrame(() => {
    payInputRef.value?.setSelectionRange(newCursor, newCursor)
  })
}

function handleCreditsInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const raw = input.value
  const cursorPos = input.selectionStart ?? raw.length
  const num = parseFormattedNumber(raw)
  const newPayAmount = Math.round(num / CREDITS_PER_DOLLAR)

  // Clamp to max immediately while typing
  const clamped = Math.min(newPayAmount, MAX_AMOUNT)
  const wasClamped = newPayAmount > MAX_AMOUNT

  showCeilingWarning.value = wasClamped
  payAmount.value = clamped
  payInputValue.value = formatNumber(clamped)
  selectedPreset.value = null

  // Format and restore cursor position
  const clampedCredits = clamped * CREDITS_PER_DOLLAR
  const { formatted, newCursor } = formatWithCursor(
    wasClamped ? formatNumber(clampedCredits) : raw,
    wasClamped ? formatNumber(clampedCredits).length : cursorPos
  )
  creditsInputValue.value = formatted

  // Restore cursor position after Vue re-render
  requestAnimationFrame(() => {
    creditsInputRef.value?.setSelectionRange(newCursor, newCursor)
  })
}

function handlePayInputBlur() {
  const clamped = clamp(payAmount.value, 0, MAX_AMOUNT)
  payAmount.value = clamped
  payInputValue.value = formatNumber(clamped)
  creditsInputValue.value = formatNumber(clamped * CREDITS_PER_DOLLAR)
}

function handleCreditsInputBlur() {
  const clamped = clamp(payAmount.value, 0, MAX_AMOUNT)
  payAmount.value = clamped
  payInputValue.value = formatNumber(clamped)
  creditsInputValue.value = formatNumber(clamped * CREDITS_PER_DOLLAR)
}

function handleInputFocus(e: FocusEvent) {
  ;(e.target as HTMLInputElement).select()
}

function handlePayStep(direction: 1 | -1) {
  showCeilingWarning.value = false
  const step = getStepAmount(payAmount.value)
  const newAmount = Math.max(0, payAmount.value + step * direction)
  updatePayAmount(newAmount)
}

function handleCreditsStep(direction: 1 | -1) {
  showCeilingWarning.value = false
  const step = getStepAmount(payAmount.value) * CREDITS_PER_DOLLAR
  const newCredits = Math.max(0, credits.value + step * direction)
  const newPayAmount = Math.round(newCredits / CREDITS_PER_DOLLAR)
  updatePayAmount(newPayAmount)
}

function handlePresetClick(amount: number) {
  showCeilingWarning.value = false
  updatePayAmount(amount, true)
}

function handleClose() {
  dialogStore.closeDialog({ key: 'top-up-credits' })
}

async function handleBuy() {
  if (!isValidAmount.value) return

  loading.value = true
  try {
    telemetry?.trackApiCreditTopupButtonPurchaseClicked(payAmount.value)
    await authActions.purchaseCredits(payAmount.value)
  } catch (error) {
    console.error('Purchase failed:', error)

    const errorMessage =
      error instanceof Error ? error.message : t('credits.topUp.unknownError')
    toast.add({
      severity: 'error',
      summary: t('credits.topUp.purchaseError'),
      detail: t('credits.topUp.purchaseErrorDetail', { error: errorMessage }),
      life: 5000
    })
  } finally {
    loading.value = false
  }
}
</script>
