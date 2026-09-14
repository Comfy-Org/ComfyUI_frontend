<script setup lang="ts">
import {
  Check,
  Clock,
  Coins,
  ExternalLink,
  Loader2,
  Minus,
  Plus
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { externalLinks } from '../../config/routes'
import {
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
  TOP_UP_PACKS,
  clampTopUp,
  usdToCredits
} from '../../config/credits'
import {
  clearTopUpWatch,
  refreshWorkshopCredits,
  useTopUpWatch,
  useWorkshopCredits,
  watchForTopUp
} from '../../config/workshop-credits'
import { WORKSHOP_CREDITS_URL } from '../../config/workshop-env'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { TopUpCheckoutSession } from '../../lib/workshop/buy-credits'
import {
  TopUpCheckoutError,
  createTopUpCheckout
} from '../../lib/workshop/buy-credits'
import {
  subscribeToTopUpReturns,
  topUpReturnUrl
} from '../../lib/workshop/topup-return'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { session, ensureFresh } = useWorkshopSession()
const { balance } = useWorkshopCredits()
const usd = ref(25)
const credits = computed(() => usdToCredits(usd.value))
const state = ref<'amount' | 'pending' | 'checkout' | 'failed'>('amount')
const topUp = useTopUpWatch()
const lastCheckout = ref<TopUpCheckoutSession | undefined>(undefined)

interface CheckoutAttempt {
  readonly id: string
  readonly uid: string
  readonly workspaceId: string
  readonly workspaceName: string
  readonly previousCredits: number
  readonly returned: boolean
}

interface CheckoutScope {
  readonly uid: string
  readonly workspaceId: string
  readonly workspaceName: string
}

const checkoutAttempt = ref<CheckoutAttempt | undefined>(undefined)
let checkoutController: AbortController | undefined
let checkoutTab: Window | null = null
let unsubscribeFromTopUpReturns: (() => void) | undefined

// The hand-off owns the step from the moment it happens: waiting is 4a,
// landed 4b, unresolved 4c; before that, the amount card and its errors.
// The step latches: once the return flow is showing, a transient idle from
// the watch must not flash the amount card between two of its states.
const latchedReturn = ref<'waiting' | 'landed' | 'unresolved' | undefined>(
  undefined
)
watch(
  topUp,
  (value) => {
    if (value.status !== 'idle') {
      latchedReturn.value = value.status
      return
    }
    if (latchedReturn.value !== undefined) {
      latchedReturn.value = undefined
      lastCheckout.value = undefined
      checkoutAttempt.value = undefined
      open.value = false
    }
  },
  { immediate: true }
)
const step = computed(() => latchedReturn.value ?? state.value)
const landedDelta = computed(() =>
  topUp.value.status === 'landed'
    ? topUp.value.newCredits - topUp.value.previousCredits
    : 0
)
const previousCredits = computed(() =>
  topUp.value.status === 'idle' ? 0 : topUp.value.previousCredits
)
const topUpWorkspaceName = computed(() =>
  topUp.value.status === 'idle' ? '' : topUp.value.workspaceName
)

// A receipt nobody acknowledged within a minute was read off the chip
// instead; greeting the next visit with it would look like a fresh grant.
const STALE_RECEIPT_MS = 60_000

watch(open, (value) => {
  if (!value) {
    cancelPendingCheckout()
    usd.value = 25
    state.value = 'amount'
    if (
      latchedReturn.value === 'landed' ||
      latchedReturn.value === 'unresolved'
    ) {
      clearReturnReceipt()
    }
    return
  }
  if (
    topUp.value.status === 'landed' &&
    Date.now() - topUp.value.landedAt > STALE_RECEIPT_MS
  ) {
    clearTopUpWatch()
    latchedReturn.value = undefined
  } else if (topUp.value.status === 'idle') {
    latchedReturn.value = undefined
  }
})

function clearReturnReceipt(): void {
  latchedReturn.value = undefined
  lastCheckout.value = undefined
  checkoutAttempt.value = undefined
  if (topUp.value.status !== 'idle') clearTopUpWatch()
}

function finish() {
  cancelPendingCheckout()
  clearReturnReceipt()
  open.value = false
}

onMounted(() => {
  unsubscribeFromTopUpReturns = subscribeToTopUpReturns(onTopUpReturn)
})

onBeforeUnmount(() => {
  cancelPendingCheckout()
  unsubscribeFromTopUpReturns?.()
})

function setAmount(next: number) {
  usd.value = clampTopUp(next)
}

function cancelPendingCheckout(): void {
  const controller = checkoutController
  checkoutController = undefined
  controller?.abort()
  closeCheckoutTab(checkoutTab)
  checkoutTab = null
}

function claimCheckoutTab(): Window | null {
  try {
    const tab = window.open('about:blank', '_blank')
    if (tab) tab.opener = null
    return tab
  } catch {
    return null
  }
}

function closeCheckoutTab(tab: Window | null): void {
  try {
    tab?.close()
  } catch {
    // A closed or browser-owned tab is already outside this page's control.
  }
}

function navigateCheckoutTab(tab: Window | null, url: string): void {
  try {
    tab?.location.assign(url)
  } catch {
    closeCheckoutTab(tab)
  }
}

function onTopUpReturn(attemptId: string): void {
  const attempt = checkoutAttempt.value
  if (!attempt || attempt.id !== attemptId || attempt.returned) return
  checkoutAttempt.value = { ...attempt, returned: true }
  watchForTopUp({
    uid: attempt.uid,
    workspaceId: attempt.workspaceId,
    workspaceName: attempt.workspaceName,
    previousCredits: attempt.previousCredits
  })
}

function captureCheckoutScope(): CheckoutScope | undefined {
  const current = session.value
  if (!current) return undefined
  return {
    uid: current.uid,
    workspaceId: current.workspace.id,
    workspaceName: current.workspace.name
  }
}

function checkoutScopeIsCurrent(scope: CheckoutScope): boolean {
  const current = session.value
  return (
    current?.uid === scope.uid && current.workspace.id === scope.workspaceId
  )
}

function requireCurrentCheckoutScope(
  scope: CheckoutScope,
  message: string
): void {
  if (!checkoutScopeIsCurrent(scope)) throw new Error(message)
}

async function creditsBeforeCheckout(
  scope: CheckoutScope,
  controller: AbortController
): Promise<number> {
  await refreshWorkshopCredits({ force: true })
  controller.signal.throwIfAborted()
  requireCurrentCheckoutScope(scope, 'Credit balance is unavailable')
  const currentBalance = balance.value
  if (currentBalance.status !== 'ok')
    throw new Error('Credit balance is unavailable')
  return currentBalance.credits
}

async function tokenForCheckout(
  scope: CheckoutScope,
  controller: AbortController
): Promise<string> {
  const fresh = await ensureFresh(undefined, {
    workspaceId: scope.workspaceId,
    signal: controller.signal,
    timeoutMs: 15_000
  })
  controller.signal.throwIfAborted()
  if (fresh?.status !== 'ok') throw new Error('Session changed before checkout')
  if (
    fresh.session.uid !== scope.uid ||
    fresh.session.workspace.id !== scope.workspaceId
  )
    throw new Error('Session changed before checkout')
  requireCurrentCheckoutScope(scope, 'Session changed before checkout')
  return fresh.session.token
}

function recordCheckout(
  scope: CheckoutScope,
  attemptId: string,
  previousCredits: number,
  checkout: TopUpCheckoutSession,
  tab: Window | null
): void {
  lastCheckout.value = checkout
  checkoutAttempt.value = {
    id: attemptId,
    uid: scope.uid,
    workspaceId: scope.workspaceId,
    workspaceName: scope.workspaceName,
    previousCredits,
    returned: false
  }
  state.value = 'checkout'
  navigateCheckoutTab(tab, checkout.url)
}

function checkoutEndpointIsUnavailable(error: unknown): boolean {
  return (
    error instanceof TopUpCheckoutError &&
    error.status === 404 &&
    error.code === 'NOT_FOUND'
  )
}

function handleCheckoutFailure(
  error: unknown,
  controller: AbortController,
  tab: Window | null
): void {
  if (checkoutController !== controller) return
  if (checkoutEndpointIsUnavailable(error)) {
    lastCheckout.value = { url: WORKSHOP_CREDITS_URL }
    checkoutAttempt.value = undefined
    state.value = 'checkout'
    navigateCheckoutTab(tab, WORKSHOP_CREDITS_URL)
    return
  }
  closeCheckoutTab(tab)
  state.value = 'failed'
}

function releaseCheckoutAttempt(
  controller: AbortController,
  tab: Window | null
): void {
  if (checkoutController === controller) checkoutController = undefined
  if (checkoutTab === tab) checkoutTab = null
}

async function continueToCheckout() {
  if (state.value === 'pending') return
  const amountCents = clampTopUp(usd.value) * 100
  const scope = captureCheckoutScope()
  if (!scope) return
  const controller = new AbortController()
  const tab = claimCheckoutTab()
  checkoutController = controller
  checkoutTab = tab
  state.value = 'pending'
  try {
    const previousCredits = await creditsBeforeCheckout(scope, controller)
    const token = await tokenForCheckout(scope, controller)
    const attemptId = crypto.randomUUID()
    const checkout = await createTopUpCheckout({
      token,
      amountCents,
      returnUrl: topUpReturnUrl(window.location.href, attemptId),
      idempotencyKey: attemptId,
      signal: controller.signal
    })
    controller.signal.throwIfAborted()
    if (checkoutController !== controller)
      throw new Error('Session changed before checkout opened')
    requireCurrentCheckoutScope(scope, 'Session changed before checkout opened')
    recordCheckout(scope, attemptId, previousCredits, checkout, tab)
  } catch (error) {
    handleCheckoutFailure(error, controller, tab)
  } finally {
    releaseCheckoutAttempt(controller, tab)
  }
}

const format = (value: number) => value.toLocaleString(locale)
const packClass = (selected: boolean) =>
  cn(
    'flex cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-left transition-colors disabled:cursor-wait disabled:opacity-60',
    selected
      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
  )
const stepperClass =
  'grid size-7 cursor-pointer place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 disabled:opacity-40'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.credits.close', locale)"
      class="flex flex-col gap-6 sm:max-w-xl"
      data-testid="buy-credits-dialog"
    >
      <template v-if="step === 'checkout'">
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.checkoutOpenedTitle', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.checkoutOpenedBody', locale) }}
        </DialogDescription>
        <div class="mt-2 flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-checkout-close"
            @click="open = false"
          >
            {{ t('workshop.credits.close', locale) }}
          </Button>
          <Button
            v-if="lastCheckout"
            as="a"
            :href="lastCheckout.url"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            class="px-5"
            data-testid="buy-credits-open-checkout"
          >
            {{ t('workshop.credits.openCheckout', locale) }}
            <template #append>
              <ExternalLink class="size-4" aria-hidden="true" />
            </template>
          </Button>
        </div>
      </template>

      <template v-else-if="step === 'waiting'">
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
          v-if="lastCheckout"
          class="flex flex-wrap items-center gap-2 text-sm text-primary-warm-gray"
        >
          {{ t('workshop.credits.reopenPrompt', locale) }}
          <a
            :href="lastCheckout.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-comfy-yellow underline-offset-4 hover:underline"
            data-testid="buy-credits-reopen"
          >
            {{ t('workshop.credits.reopen', locale) }}
          </a>
        </p>
        <p class="text-sm text-primary-warm-gray">
          {{ t('workshop.credits.closingIsSafe', locale) }}
        </p>
      </template>

      <template v-else-if="step === 'landed'">
        <span
          class="border-primary-comfy-yellow text-primary-comfy-yellow -mb-2 grid size-16 shrink-0 place-items-center self-center rounded-full border-2"
          aria-hidden="true"
        >
          <Check class="size-7" :stroke-width="2.5" />
        </span>
        <DialogTitle class="px-8 text-center" data-testid="buy-credits-done">
          {{
            t('workshop.credits.done', locale).replace(
              '{n}',
              format(landedDelta)
            )
          }}
        </DialogTitle>
        <DialogDescription
          class="px-8 text-center text-base text-primary-comfy-canvas/70"
        >
          {{
            t('workshop.credits.addedTo', locale).replace(
              '{workspace}',
              topUpWorkspaceName
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
              +{{ format(landedDelta) }}
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
              {{ format(previousCredits + landedDelta) }}
            </dd>
          </div>
        </dl>
        <Button
          size="lg"
          class="mt-2 ml-auto w-fit px-5"
          data-testid="buy-credits-resume"
          @click="finish"
        >
          {{ t('workshop.credits.resume', locale) }}
        </Button>
      </template>

      <template v-else-if="step === 'unresolved'">
        <span
          class="-mb-2 grid size-16 shrink-0 place-items-center self-center rounded-full border-2 border-primary-comfy-canvas/70 text-primary-comfy-canvas/70"
          aria-hidden="true"
        >
          <Clock class="size-7" />
        </span>
        <DialogTitle class="px-8 text-center" data-testid="buy-credits-held">
          {{ t('workshop.credits.heldTitle', locale) }}
        </DialogTitle>
        <DialogDescription
          class="px-8 text-center text-base text-primary-comfy-canvas/70"
        >
          {{ t('workshop.credits.heldBody', locale) }}
        </DialogDescription>
        <div
          v-if="lastCheckout?.sessionId"
          class="bg-transparency-white-t4 flex flex-col gap-1 rounded-2xl px-4 py-3"
        >
          <span class="text-xs text-primary-warm-gray">
            {{ t('workshop.credits.heldSupport', locale) }}
          </span>
          <span
            class="font-mono text-sm text-primary-warm-white"
            data-testid="buy-credits-session-id"
          >
            {{ lastCheckout.sessionId }}
          </span>
        </div>
        <div class="mt-2 flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-held-close"
            @click="finish"
          >
            {{ t('workshop.credits.close', locale) }}
          </Button>
          <Button
            as="a"
            :href="externalLinks.support"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            class="px-5"
            data-testid="buy-credits-support"
          >
            {{ t('workshop.credits.contactSupport', locale) }}
          </Button>
        </div>
      </template>

      <template v-else>
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.title', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.body', locale) }}
        </DialogDescription>

        <fieldset
          :disabled="state === 'pending'"
          class="m-0 flex min-w-0 flex-col gap-6 border-0 p-0"
          data-testid="buy-credits-controls"
        >
          <div
            class="grid grid-cols-2 gap-2 sm:grid-cols-4"
            data-testid="buy-credits-packs"
          >
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
        </fieldset>

        <p
          v-if="state === 'failed'"
          role="status"
          class="text-sm text-red-400"
          data-testid="checkout-error"
        >
          {{ t('workshop.error.checkoutFailed', locale) }}
        </p>

        <div class="mt-2 flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            :disabled="state === 'pending'"
            data-testid="buy-credits-cancel"
            @click="open = false"
          >
            {{ t('workshop.credits.cancel', locale) }}
          </Button>
          <Button
            size="lg"
            class="px-5"
            :disabled="state === 'pending'"
            data-testid="buy-credits-continue"
            @click="continueToCheckout"
          >
            {{ t('workshop.credits.continue', locale) }}
            <template #append>
              <ExternalLink class="size-4" aria-hidden="true" />
            </template>
          </Button>
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
