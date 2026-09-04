<script setup lang="ts">
import {
  Check,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
  Lock,
  Minus,
  Plus
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../composables/useMockSession'
import { usePrototypeTweaks } from '../../composables/usePrototypeTweaks'
import {
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
  TOP_UP_PACKS,
  clampTopUp,
  usdToCredits
} from '../../config/credits'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  SETTLE_DELAY_MS,
  returnStepFor,
  stripeCheckoutHref
} from '../../lib/workshop/buy-credits'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { session, addCredits } = useMockSession()
const { topUpOutcome, buyStep } = usePrototypeTweaks()

const usd = ref<number>(25)
const credits = computed(() => usdToCredits(usd.value))
const workspace = computed(() =>
  session.value.status === 'signedIn' ? session.value.account.workspace : ''
)

// The real flow leaves for Stripe Checkout and comes back on a fresh page load.
// The prototype plays that round trip out in place, so the whole journey can be
// reviewed without a payment account — but the states after the hand-off are the
// ones the live page will really have to render.
type Step = 'leaving' | 'checkout' | 'waiting' | 'landed' | 'unresolved'
const step = ref<Step>('leaving')
// Canceling at Stripe is not a failure: it returns to the amount with the
// chosen amount intact and nothing to retry.
const canceled = ref(false)
const previousCredits = ref(0)

const returnPath = ref('/workshop/')
const href = computed(() => stripeCheckoutHref(returnPath.value, usd.value))
// Stands in for the billing operation id support would search on.
const operationId = computed(
  () => `op_${(usdToCredits(usd.value) * 7919).toString(36)}`
)

let settleTimer: ReturnType<typeof setTimeout> | undefined
function clearSettleTimer() {
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = undefined
}
onBeforeUnmount(clearSettleTimer)

const RETURN_STEPS = ['waiting', 'landed', 'unresolved'] as const
function isReturnStep(value: string): value is (typeof RETURN_STEPS)[number] {
  return (RETURN_STEPS as readonly string[]).includes(value)
}

watch(open, (value) => {
  clearSettleTimer()
  if (!value) return
  returnPath.value = location.pathname + location.search
  // A review link can open any part of the flow. The states after the hand-off
  // are three clicks deep otherwise, and they are the ones worth looking at.
  const entry = buyStep.value
  // Consumed once: after the link has opened its step, the dialog behaves
  // normally, so closing and reopening does not jump back and grant again.
  if (entry !== 'closed') buyStep.value = 'closed'
  canceled.value = entry === 'canceled'
  step.value = isReturnStep(entry) ? entry : 'leaving'
  if (step.value === 'landed') {
    previousCredits.value =
      session.value.status === 'signedIn' ? session.value.account.credits : 0
    // Land the grant too, so the ledger and the header agree.
    addCredits(credits.value)
  }
})

function setAmount(next: number) {
  usd.value = clampTopUp(next)
}

function leaveForStripe() {
  canceled.value = false
  step.value = 'checkout'
}

function cancelAtStripe() {
  clearSettleTimer()
  canceled.value = true
  step.value = 'leaving'
}

// Stripe redirects the moment the card clears; the grant follows on a webhook.
// Coming back before the credits do is the normal case, not an edge one, so the
// page always lands on `waiting` first and resolves from there.
function pay() {
  previousCredits.value =
    session.value.status === 'signedIn' ? session.value.account.credits : 0
  step.value = 'waiting'
  const settled = returnStepFor(topUpOutcome.value)
  if (settled === 'waiting') return
  clearSettleTimer()
  settleTimer = setTimeout(() => {
    if (settled === 'landed') addCredits(credits.value)
    step.value = settled
  }, SETTLE_DELAY_MS)
}

const format = (value: number) => value.toLocaleString(locale)
const packClass = (selected: boolean) =>
  cn(
    'flex cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-left transition-colors',
    selected
      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
  )
const stepperClass =
  'grid size-7 place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 disabled:opacity-40'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.credits.close', locale)"
      class="sm:max-w-xl"
      data-testid="buy-credits-dialog"
    >
      <!-- 1 · Amount — the last screen we own before the hand-off -->
      <div
        v-if="step === 'leaving'"
        class="flex flex-col gap-6"
        data-step="leaving"
      >
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.title', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.body', locale) }}
        </DialogDescription>

        <p
          v-if="canceled"
          class="bg-transparency-white-t4 rounded-2xl px-4 py-3 text-sm text-primary-comfy-canvas"
          data-testid="buy-credits-canceled"
        >
          {{ t('workshop.credits.canceledNotice', locale) }}
        </p>

        <div class="grid grid-cols-4 gap-2" data-testid="buy-credits-packs">
          <button
            v-for="pack in TOP_UP_PACKS"
            :key="pack"
            type="button"
            :aria-pressed="usd === pack"
            :class="packClass(usd === pack)"
            :data-testid="`buy-credits-pack-${pack}`"
            @click="setAmount(pack)"
          >
            <span class="text-lg font-bold">${{ pack }}</span>
            <span class="text-xs tabular-nums opacity-70">
              {{ format(usdToCredits(pack)) }}
            </span>
          </button>
        </div>

        <div
          class="bg-transparency-white-t4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
          data-testid="buy-credits-custom"
        >
          <span class="text-sm text-primary-warm-gray">
            {{ t('workshop.credits.custom', locale) }}
          </span>
          <span class="flex items-center gap-3">
            <button
              type="button"
              :class="stepperClass"
              :disabled="usd <= MIN_TOP_UP_USD"
              :aria-label="t('workshop.credits.less', locale)"
              data-testid="buy-credits-less"
              @click="setAmount(usd - 5)"
            >
              <Minus class="size-3.5" aria-hidden="true" />
            </button>
            <span
              class="w-28 text-right text-sm text-primary-comfy-canvas tabular-nums"
            >
              ${{ format(usd) }} · {{ format(credits) }}
            </span>
            <button
              type="button"
              :class="stepperClass"
              :disabled="usd >= MAX_TOP_UP_USD"
              :aria-label="t('workshop.credits.more', locale)"
              data-testid="buy-credits-more"
              @click="setAmount(usd + 5)"
            >
              <Plus class="size-3.5" aria-hidden="true" />
            </button>
          </span>
        </div>

        <p
          class="bg-transparency-white-t4 overflow-x-auto rounded-2xl px-4 py-3 font-mono text-xs whitespace-nowrap text-primary-warm-gray"
          data-testid="buy-credits-url"
        >
          {{ href }}
        </p>

        <div class="flex flex-wrap gap-3">
          <Button
            size="lg"
            class="px-5"
            data-testid="buy-credits-continue"
            @click="leaveForStripe"
          >
            {{ t('workshop.credits.continue', locale) }}
            <template #append>
              <ExternalLink class="size-4" aria-hidden="true" />
            </template>
          </Button>
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-cancel"
            @click="open = false"
          >
            {{ t('workshop.credits.cancel', locale) }}
          </Button>
        </div>
      </div>

      <!-- 2 · Stripe's page. Never renders live: the browser is on stripe.com. -->
      <div
        v-else-if="step === 'checkout'"
        class="flex flex-col gap-6"
        data-step="checkout"
      >
        <p
          class="inline-flex w-fit items-center gap-2 rounded-full bg-transparency-white-t8 px-3 py-1.5 text-xs text-primary-warm-gray"
        >
          <Lock class="size-3.5" aria-hidden="true" />
          checkout.stripe.com
        </p>
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.checkout', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.checkoutNote', locale) }}
        </DialogDescription>

        <dl
          class="bg-transparency-white-t4 flex items-baseline justify-between rounded-2xl px-4 py-3 text-sm"
        >
          <dt class="text-primary-comfy-canvas">
            {{ format(credits) }} {{ t('nav.credits', locale) }}
          </dt>
          <dd class="text-lg font-bold text-primary-warm-white">
            ${{ format(usd) }}
          </dd>
        </dl>

        <div class="flex flex-wrap gap-3">
          <Button
            size="lg"
            class="px-5"
            data-testid="buy-credits-pay"
            @click="pay"
          >
            {{
              t('workshop.credits.pay', locale).replace(
                '{usd}',
                `$${format(usd)}`
              )
            }}
          </Button>
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-cancel-stripe"
            @click="cancelAtStripe"
          >
            {{ t('workshop.credits.cancelAtStripe', locale) }}
          </Button>
        </div>
      </div>

      <!-- 3a · Waiting. No pending signal exists on this rail, so this is also
           what a lost grant looks like — only elapsed time tells them apart. -->
      <div
        v-else-if="step === 'waiting'"
        class="flex flex-col gap-6"
        data-step="waiting"
      >
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.waitingTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.waitingBody', locale) }}
        </DialogDescription>
        <p
          class="bg-transparency-white-t4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-primary-comfy-canvas"
          data-testid="buy-credits-polling"
        >
          <Loader2
            class="text-primary-comfy-yellow size-4 animate-spin"
            aria-hidden="true"
          />
          {{ t('workshop.credits.waitingPolling', locale) }}
        </p>
        <Button
          variant="outline"
          size="lg"
          class="w-fit px-5"
          data-testid="buy-credits-reopen"
          @click="step = 'checkout'"
        >
          {{ t('workshop.credits.reopen', locale) }}
        </Button>
      </div>

      <!-- 3b · The credits landed. -->
      <div
        v-else-if="step === 'landed'"
        class="flex flex-col gap-6"
        data-testid="buy-credits-done"
        data-step="landed"
      >
        <span
          class="bg-primary-comfy-yellow grid size-12 place-items-center rounded-2xl text-primary-comfy-ink"
          aria-hidden="true"
        >
          <Check class="size-6" :stroke-width="3" />
        </span>
        <DialogTitle class="pr-16">
          {{
            t('workshop.credits.done', locale).replace('{n}', format(credits))
          }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{
            t('workshop.credits.addedTo', locale).replace(
              '{workspace}',
              workspace
            )
          }}
        </DialogDescription>

        <dl
          class="bg-transparency-white-t4 flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm"
          data-testid="buy-credits-ledger"
        >
          <div class="flex items-baseline justify-between">
            <dt class="text-primary-warm-gray">
              {{ t('workshop.credits.previousBalance', locale) }}
            </dt>
            <dd class="text-primary-warm-gray tabular-nums">
              {{ format(previousCredits) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between">
            <dt class="text-primary-warm-gray">
              {{ t('workshop.credits.added', locale) }}
            </dt>
            <dd class="text-primary-warm-gray tabular-nums">
              +{{ format(credits) }}
            </dd>
          </div>
          <div
            class="flex items-baseline justify-between border-t border-transparency-white-t8 pt-2"
          >
            <dt class="text-primary-comfy-canvas">
              {{ t('workshop.credits.newBalance', locale) }}
            </dt>
            <dd
              class="flex items-center gap-1.5 font-bold text-primary-warm-white tabular-nums"
            >
              <Coins class="size-4" aria-hidden="true" />
              {{ format(previousCredits + credits) }}
            </dd>
          </div>
        </dl>

        <Button
          size="lg"
          class="w-fit px-5"
          data-testid="buy-credits-resume"
          @click="open = false"
        >
          {{ t('workshop.credits.resume', locale) }}
        </Button>
      </div>

      <!-- 3c · Paid, but nothing arrived. Deliberately promises no self-healing:
           this rail has no reconciler (IR-126/128), unlike the in-app one. -->
      <div
        v-else
        class="flex flex-col gap-6"
        data-testid="buy-credits-held"
        data-step="unresolved"
      >
        <span
          class="grid size-12 place-items-center rounded-2xl bg-transparency-white-t8 text-primary-warm-white"
          aria-hidden="true"
        >
          <Clock class="size-6" />
        </span>
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.heldTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.heldBody', locale) }}
        </DialogDescription>

        <div
          class="bg-transparency-white-t4 flex flex-col gap-1 rounded-2xl px-4 py-3"
        >
          <span class="text-xs text-primary-warm-gray">
            {{ t('workshop.credits.heldSupport', locale) }}
          </span>
          <span
            class="font-mono text-sm text-primary-warm-white"
            data-testid="buy-credits-op-id"
          >
            {{ operationId }}
          </span>
        </div>

        <div class="flex flex-wrap gap-3">
          <Button size="lg" class="px-5" data-testid="buy-credits-support">
            {{ t('workshop.credits.contactSupport', locale) }}
          </Button>
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-held-close"
            @click="open = false"
          >
            {{ t('workshop.credits.close', locale) }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
