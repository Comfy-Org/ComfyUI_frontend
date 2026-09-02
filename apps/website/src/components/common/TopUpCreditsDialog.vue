<script setup lang="ts">
import { ArrowLeft, Coins, ExternalLink } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import { useMockSession } from '../../composables/useMockSession'
import { useTopUpDialog } from '../../composables/useTopUpDialog'
import {
  TOP_UP_MAX_USD,
  TOP_UP_MIN_USD,
  TOP_UP_PRESETS_USD,
  creditsToUsd,
  usdToCredits
} from '../../config/credits'
import { PRICING_URL } from '../../config/model-pricing'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { isOpen, insufficient, close } = useTopUpDialog()
const { addCredits } = useMockSession()

type Step = 'amount' | 'confirm' | 'processing' | 'done'
const step = ref<Step>('amount')
const payUsd = ref<number>(50)

const credits = computed(() => usdToCredits(payUsd.value))
const isBelowMin = computed(() => payUsd.value < TOP_UP_MIN_USD)
const isAboveMax = computed(() => payUsd.value > TOP_UP_MAX_USD)
const isValidAmount = computed(
  () => payUsd.value > 0 && !isBelowMin.value && !isAboveMax.value
)

const numberFormat = new Intl.NumberFormat(locale)
const currencyFormat = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'USD'
})
const total = computed(() => currencyFormat.format(payUsd.value))

watch(isOpen, (open) => {
  if (open) {
    step.value = 'amount'
    payUsd.value = 50
  }
})

function onPayInput(event: Event) {
  payUsd.value = Number((event.target as HTMLInputElement).value) || 0
}

function onCreditsInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value) || 0
  payUsd.value = Math.round(creditsToUsd(value) * 100) / 100
}

let timer: ReturnType<typeof setTimeout> | undefined

function pay() {
  step.value = 'processing'
  timer = setTimeout(() => {
    addCredits(credits.value)
    step.value = 'done'
  }, 1500)
}

function onOpenChange(open: boolean) {
  if (!open) {
    clearTimeout(timer)
    close()
  }
}

const inputClass =
  'h-11 w-full rounded-2xl border border-transparency-white-t20 bg-transparency-white-t4 pr-4 pl-9 text-base font-semibold text-primary-warm-white outline-none tabular-nums focus-visible:border-primary-comfy-yellow focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50'
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent
      :close-label="t('nav.close', locale)"
      class="sm:max-w-lg"
      data-testid="top-up-dialog"
    >
      <div class="flex items-center gap-2 pr-12">
        <button
          v-if="step === 'confirm'"
          type="button"
          :aria-label="t('nav.back', locale)"
          class="cursor-pointer text-primary-warm-gray hover:text-primary-warm-white"
          @click="step = 'amount'"
        >
          <ArrowLeft class="size-5" aria-hidden="true" />
        </button>
        <DialogTitle class="text-xl font-bold">
          {{
            step === 'confirm'
              ? t('workshop.topUp.confirmTitle', locale)
              : step === 'done'
                ? t('workshop.topUp.purchaseSuccess', locale)
                : insufficient
                  ? t('workshop.topUp.addMoreCreditsToRun', locale)
                  : t('workshop.topUp.addMoreCredits', locale)
          }}
        </DialogTitle>
      </div>

      <template v-if="step === 'amount'">
        <p
          v-if="insufficient"
          class="mt-2 text-sm text-primary-warm-gray"
          data-testid="top-up-insufficient"
        >
          {{ t('workshop.topUp.insufficientMessage', locale) }}
        </p>

        <p class="mt-8 text-sm text-primary-warm-gray">
          {{ t('workshop.topUp.selectAmount', locale) }}
        </p>
        <div class="mt-3 flex gap-2">
          <button
            v-for="amount in TOP_UP_PRESETS_USD"
            :key="amount"
            type="button"
            :data-testid="`top-up-preset-${amount}`"
            :class="
              cn(
                'h-10 flex-1 cursor-pointer rounded-2xl border text-base font-medium tabular-nums transition-colors',
                payUsd === amount
                  ? 'border-primary-comfy-yellow bg-primary-comfy-yellow text-primary-comfy-ink'
                  : 'hover:bg-transparency-white-t4 border-transparency-white-t20 text-primary-warm-white'
              )
            "
            @click="payUsd = amount"
          >
            ${{ amount }}
          </button>
        </div>

        <div class="mt-8 flex gap-3">
          <label
            class="flex flex-1 flex-col gap-2 text-sm text-primary-warm-gray"
          >
            {{ t('workshop.topUp.youPay', locale) }}
            <span class="relative">
              <span
                class="absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold text-primary-warm-white"
                aria-hidden="true"
              >
                $
              </span>
              <input
                type="number"
                :min="0"
                :max="TOP_UP_MAX_USD"
                :value="payUsd"
                data-testid="top-up-pay-amount"
                :class="inputClass"
                @input="onPayInput"
              />
            </span>
          </label>
          <label
            class="flex flex-1 flex-col gap-2 text-sm text-primary-warm-gray"
          >
            {{ t('workshop.topUp.youGet', locale) }}
            <span class="relative">
              <Coins
                class="text-primary-comfy-yellow absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="number"
                :min="0"
                :value="credits"
                data-testid="top-up-credits"
                :class="inputClass"
                @input="onCreditsInput"
              />
            </span>
          </label>
        </div>

        <p
          v-if="isBelowMin"
          class="text-primary-comfy-orange mt-4 flex items-center justify-center gap-1 text-sm"
        >
          <Coins class="size-4" aria-hidden="true" />
          {{
            t('workshop.topUp.minRequired', locale).replace(
              '{credits}',
              numberFormat.format(usdToCredits(TOP_UP_MIN_USD))
            )
          }}
        </p>
        <p
          v-else-if="isAboveMax"
          class="text-primary-comfy-yellow mt-4 flex items-center justify-center gap-1 text-sm"
        >
          <Coins class="size-4" aria-hidden="true" />
          {{
            t('workshop.topUp.maxAllowed', locale).replace(
              '{credits}',
              numberFormat.format(usdToCredits(TOP_UP_MAX_USD))
            )
          }}
        </p>

        <Button
          size="lg"
          class="mt-8 w-full"
          :disabled="!isValidAmount"
          data-testid="top-up-continue"
          @click="step = 'confirm'"
        >
          {{ t('workshop.topUp.addCredits', locale) }}
        </Button>
        <a
          :href="PRICING_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-4 flex items-center justify-center gap-1 text-sm text-primary-warm-gray hover:text-primary-warm-white"
        >
          {{ t('workshop.topUp.viewPricing', locale) }}
          <ExternalLink class="size-4" aria-hidden="true" />
        </a>
      </template>

      <template v-else-if="step === 'confirm'">
        <p class="mt-2 text-sm text-primary-warm-gray">
          {{ t('workshop.topUp.confirmSubtitle', locale) }}
        </p>
        <p
          class="mt-6 flex items-center gap-2 text-2xl font-semibold text-primary-warm-white tabular-nums"
        >
          <Coins class="text-primary-comfy-yellow size-5" aria-hidden="true" />
          {{ numberFormat.format(credits) }}
        </p>
        <div
          class="mt-4 flex items-center justify-between border-t border-transparency-white-t8 pt-4 text-base font-semibold text-primary-warm-white"
        >
          <span>{{ t('workshop.topUp.totalDueToday', locale) }}</span>
          <span class="tabular-nums">{{ total }}</span>
        </div>
        <p class="mt-3 text-xs text-primary-warm-gray">
          {{ t('workshop.topUp.chargedImmediatelyNote', locale) }}
        </p>
        <Button
          size="lg"
          class="mt-8 w-full tabular-nums"
          data-testid="top-up-pay"
          @click="pay"
        >
          {{ t('workshop.topUp.payAmount', locale).replace('{amount}', total) }}
        </Button>
      </template>

      <template v-else-if="step === 'processing'">
        <p class="mt-8 text-sm text-primary-warm-gray" role="status">
          {{ t('workshop.topUp.processing', locale) }}
        </p>
      </template>

      <template v-else>
        <p
          class="mt-6 flex items-center gap-2 text-2xl font-semibold text-primary-warm-white tabular-nums"
          data-testid="top-up-done"
        >
          <Coins class="text-primary-comfy-yellow size-5" aria-hidden="true" />
          +{{ numberFormat.format(credits) }}
        </p>
        <p class="mt-2 text-sm text-primary-warm-gray">
          {{ t('workshop.topUp.doneBody', locale) }}
        </p>
        <Button size="lg" class="mt-8 w-full" @click="close">
          {{ t('workshop.topUp.done', locale) }}
        </Button>
      </template>
    </DialogContent>
  </Dialog>
</template>
