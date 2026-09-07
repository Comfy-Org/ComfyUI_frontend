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
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../composables/useMockSession'
import { usePendingTopUp } from '../../composables/usePendingTopUp'
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
import { stripeCheckoutHref } from '../../lib/workshop/buy-credits'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { session } = useMockSession()
const { topUpOutcome, buyStep } = usePrototypeTweaks()
const { pending, outcome, begin, settle, place, clear } = usePendingTopUp()

const usd = ref<number>(25)
const credits = computed(() => usdToCredits(usd.value))
const workspace = computed(() =>
  session.value.status === 'signedIn' ? session.value.account.workspace : ''
)

// Continue is a real link, so the tab opens on the visitor's own click and a
// popup blocker never sees a programmatic open to swallow. Cancelling then
// happens at Stripe, in the other tab: this page just keeps waiting until they
// come back or dismiss it.
//
// The purchase itself lives in usePendingTopUp, above this component, so
// dismissing the card never abandons money that is already in flight.
type Step = 'leaving' | 'checkout' | 'waiting' | 'landed' | 'unresolved'
const standIn = ref(false)
const step = computed<Step>(() =>
  standIn.value ? 'checkout' : pending.value ? outcome.value : 'leaving'
)
const previousCredits = computed(() => pending.value?.previousCredits ?? 0)

const returnPath = ref('/workshop/')
const href = computed(() => stripeCheckoutHref(returnPath.value, usd.value))
// Stands in for the billing operation id support would search on.
const operationId = computed(
  () => `op_${(usdToCredits(usd.value) * 7919).toString(36)}`
)

const RETURN_STEPS = ['waiting', 'landed', 'unresolved'] as const
function isReturnStep(value: string): value is (typeof RETURN_STEPS)[number] {
  return (RETURN_STEPS as readonly string[]).includes(value)
}

watch(open, (value) => {
  if (!value) return
  returnPath.value = location.pathname + location.search
  standIn.value = false
  // A review link can open any part of the flow. The states after the hand-off
  // are three clicks deep otherwise, and they are the ones worth looking at.
  const entry = buyStep.value
  // Consumed once, so closing and reopening behaves normally afterwards.
  if (entry !== 'closed') buyStep.value = 'closed'
  if (isReturnStep(entry)) place(entry, credits.value)
  else if (entry === 'amount') clear()
})

function setAmount(next: number) {
  usd.value = clampTopUp(next)
}

// The anchor opens Stripe; this only moves the page behind it on. In the
// prototype the navigation is prevented so Stripe's page can be played out in
// place — shipping means dropping the `.prevent` and letting the link work.
function leaveForStripe() {
  begin(credits.value)
}

function pay() {
  standIn.value = false
  settle(topUpOutcome.value)
}

// Concluding the purchase: the money has resolved either way, so stop tracking.
function finish() {
  clear()
  open.value = false
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

        <div class="flex flex-wrap gap-3">
          <Button
            size="lg"
            class="px-5"
            :href="href"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="buy-credits-continue"
            @click.prevent="leaveForStripe"
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
            data-testid="buy-credits-back"
            @click="standIn = false"
          >
            {{ t('workshop.credits.back', locale) }}
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
        <p
          class="flex flex-wrap items-center gap-2 text-sm text-primary-warm-gray"
        >
          {{ t('workshop.credits.reopenPrompt', locale) }}
          <!-- The tab is already open in the real flow; this brings it back if
               they closed it. Not a fallback — there is no blocked case. -->
          <a
            :href="href"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-comfy-yellow underline-offset-4 hover:underline"
            data-testid="buy-credits-reopen"
            @click.prevent="standIn = true"
          >
            {{ t('workshop.credits.reopen', locale) }}
          </a>
        </p>

        <!-- No button: there is no decision to make here. The X closes the card,
             and closing changes nothing — the checkout is open in the other tab
             and resolves on its own, with the page still watching. -->
        <p class="text-sm text-primary-warm-gray">
          {{ t('workshop.credits.closingIsSafe', locale) }}
        </p>
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
          @click="finish"
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
            @click="finish"
          >
            {{ t('workshop.credits.close', locale) }}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
