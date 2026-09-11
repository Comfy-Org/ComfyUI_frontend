<script setup lang="ts">
import { Check, Clock, ExternalLink, Loader2, Minus, Plus } from '@lucide/vue'
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
  useTopUpWatch,
  watchForTopUp
} from '../../config/workshop-credits'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { TopUpCheckoutSession } from '../../lib/workshop/buy-credits'
import {
  TopUpCheckoutError,
  createTopUpCheckout,
  platformTopUpHref
} from '../../lib/workshop/buy-credits'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { session } = useWorkshopSession()
const usd = ref(25)
const credits = computed(() => usdToCredits(usd.value))
const state = ref<'amount' | 'pending' | 'failed'>('amount')
const topUp = useTopUpWatch()
const lastCheckout = ref<TopUpCheckoutSession | undefined>(undefined)

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
    if (value.status !== 'idle') latchedReturn.value = value.status
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

// A receipt nobody acknowledged within a minute was read off the chip
// instead; greeting the next visit with it would look like a fresh grant.
const STALE_RECEIPT_MS = 60_000

watch(open, (value) => {
  if (!value) {
    usd.value = 25
    state.value = 'amount'
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

function finish() {
  stopAutoClose()
  clearTopUpWatch()
  latchedReturn.value = undefined
  lastCheckout.value = undefined
  open.value = false
}

// The landed card closes itself after a beat - the one state with nothing
// left to decide. The countdown runs only while the tab is being looked at,
// and any interaction cancels it, so nobody loses the ledger mid-read.
const AUTO_CLOSE_MS = 3_600
let autoCloseTimer: ReturnType<typeof setTimeout> | undefined

function stopAutoClose() {
  if (autoCloseTimer) clearTimeout(autoCloseTimer)
  autoCloseTimer = undefined
}

function scheduleAutoClose() {
  stopAutoClose()
  if (typeof document !== 'undefined' && document.hidden) return
  autoCloseTimer = setTimeout(() => finish(), AUTO_CLOSE_MS)
}

function onVisibilityChange() {
  if (step.value !== 'landed') return
  if (document.hidden) stopAutoClose()
  else scheduleAutoClose()
}

function cancelAutoClose() {
  if (step.value === 'landed') stopAutoClose()
}

watch(step, (value) => {
  if (value !== 'landed' || !open.value) {
    stopAutoClose()
    return
  }
  scheduleAutoClose()
})

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  stopAutoClose()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function setAmount(next: number) {
  usd.value = clampTopUp(next)
}

// The tab opens empty inside the click, before the awaited create - a window
// opened after the await would meet the popup blocker. A 404 is the dark
// rollout saying the flag has not reached this caller; the tab then carries
// the platform rail instead of an error.
async function continueToCheckout() {
  if (state.value === 'pending' || !session.value) return
  const forWorkspace = session.value
  state.value = 'pending'
  const tab = window.open('/checkout-opening', '_blank')
  try {
    const checkout = await createTopUpCheckout(
      forWorkspace.token,
      usd.value * 100
    )
    state.value = 'amount'
    lastCheckout.value = checkout
    watchForTopUp()
    if (tab) tab.location.assign(checkout.url)
    else window.location.assign(checkout.url)
  } catch (error) {
    if (error instanceof TopUpCheckoutError && error.status === 404) {
      state.value = 'amount'
      open.value = false
      const fallback = platformTopUpHref(forWorkspace.workspace.id)
      state.value = 'amount'
      lastCheckout.value = { url: fallback }
      watchForTopUp()
      if (tab) tab.location.assign(fallback)
      else window.location.assign(fallback)
      return
    }
    tab?.close()
    state.value = 'failed'
  }
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
  'grid size-7 cursor-pointer place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 disabled:opacity-40'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.credits.close', locale)"
      class="flex flex-col gap-6 sm:max-w-xl"
      data-testid="buy-credits-dialog"
      @pointerdown="cancelAutoClose"
      @keydown="cancelAutoClose"
    >
      <template v-if="step === 'waiting'">
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
              () => session?.workspace.name ?? ''
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
