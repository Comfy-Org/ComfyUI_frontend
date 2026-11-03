<template>
  <div
    :class="
      cn(
        'flex w-[min(400px,95vw)] flex-col rounded-2xl border bg-card text-sm text-foreground shadow-md',
        ui.root
      )
    "
    data-testid="add-credits-dialog"
    :data-step="dialog.state.value.step"
  >
    <div :class="cn('flex items-center justify-between px-4 pt-4', ui.header)">
      <component
        :is="titleAs"
        :class="cn('m-0 text-base font-normal', ui.title)"
      >
        {{ title }}
      </component>
      <button
        type="button"
        :class="
          cn(
            buttonVariants({ variant: 'muted-textonly', size: 'icon' }),
            ui.close
          )
        "
        :aria-label="translate('close')"
        @click="emit('close')"
      >
        <i class="icon-[lucide--x]" aria-hidden="true" />
      </button>
    </div>

    <template v-if="amountView">
      <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
        <slot name="description" />
        <RadioGroupRoot
          :model-value="selectedPreset"
          :disabled="amountView.locked"
          orientation="horizontal"
          :class="cn('grid grid-cols-4 gap-2', ui.presets)"
          :aria-label="translate('title')"
          @update:model-value="pickPreset"
        >
          <RadioGroupItem
            v-for="cents in ADD_CREDITS_PRESETS_CENTS"
            :key="cents"
            :value="String(cents)"
            :class="
              cn(
                buttonVariants({ variant: 'secondary', size: 'lg' }),
                'border border-solid border-transparent text-base data-[state=checked]:border-foreground',
                ui.preset
              )
            "
          >
            {{ formatDollars(cents) }}
          </RadioGroupItem>
        </RadioGroupRoot>

        <p
          v-if="negativeBalanceCredits !== undefined"
          :class="cn('m-0 text-muted-foreground', ui.line)"
          data-testid="add-credits-negative-balance"
        >
          {{
            translate('negativeBalance', {
              credits: formatCredits(negativeBalanceCredits)
            })
          }}
        </p>
        <p
          v-if="planLine"
          :class="cn('m-0 text-muted-foreground', ui.line)"
          data-testid="add-credits-plan-line"
        >
          {{ translate(`planLine.${planLine}`) }}
        </p>

        <div class="flex flex-col gap-2">
          <label :for="fieldId" class="text-muted-foreground">
            {{ translate('customAmountLabel') }}
          </label>
          <div
            :class="
              cn(
                'flex h-10 items-center gap-2 rounded-lg border border-solid border-transparent bg-secondary px-4 focus-within:border-foreground',
                amountError &&
                  'border-destructive focus-within:border-destructive',
                amountView.locked && 'opacity-50',
                ui.field
              )
            "
          >
            <span class="text-muted-foreground" aria-hidden="true">$</span>
            <input
              :id="fieldId"
              :value="customInput"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              :disabled="amountView.locked"
              :aria-invalid="amountError ? true : undefined"
              :aria-describedby="amountError ? errorId : undefined"
              class="min-w-0 flex-1 border-none bg-transparent text-base text-foreground outline-none"
              data-testid="add-credits-amount-input"
              @input="onInput"
            />
          </div>
          <p
            :id="errorId"
            :class="cn('m-0 min-h-5 text-destructive', ui.error)"
            data-testid="add-credits-amount-error"
            :aria-live="amountError ? 'polite' : undefined"
          >
            {{ amountError }}
          </p>
        </div>

        <slot
          name="notice"
          :notice="amountView.notice"
          :title="noticeCopy?.title"
          :body="noticeCopy?.body"
        >
          <div
            v-if="noticeCopy"
            :role="noticeCopy.tone === 'warning' ? 'alert' : 'status'"
            :class="
              cn(
                'flex gap-2 rounded-lg border border-solid p-3',
                noticeCopy.tone === 'warning'
                  ? 'border-warning/60 bg-warning/10'
                  : 'border-border',
                ui.notice
              )
            "
            data-testid="add-credits-notice"
            :data-notice="noticeKind"
          >
            <i
              :class="
                cn(
                  'mt-0.5 icon-[lucide--circle-alert]',
                  noticeCopy.tone === 'warning'
                    ? 'text-warning'
                    : 'text-muted-foreground'
                )
              "
              aria-hidden="true"
            />
            <div class="flex flex-col">
              <span class="text-foreground">{{ noticeCopy.title }}</span>
              <span class="text-muted-foreground">
                <template v-for="(part, index) in noticeCopy.body" :key="index">
                  <a
                    v-if="part === SUPPORT_TOKEN"
                    :href="supportUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-inherit underline"
                    >{{ translate('messageSupport') }}</a
                  >
                  <template v-else>{{ part }}</template>
                </template>
              </span>
            </div>
          </div>
        </slot>
        <slot v-if="!amountView.notice" name="extra" />
      </div>

      <div
        :class="
          cn(
            'flex items-center justify-between gap-4 border-t border-solid px-4 py-4',
            ui.footer
          )
        "
      >
        <div class="flex min-w-0 flex-col" data-testid="add-credits-summary">
          <span class="text-base font-semibold text-foreground tabular-nums">
            <span
              v-if="footer.credits === 'loading'"
              class="inline-block h-4 w-24 animate-pulse rounded-sm bg-secondary align-middle"
              data-testid="add-credits-credits-loading"
            />
            <template v-else>{{ footer.credits }}</template>
          </span>
          <span class="text-muted-foreground tabular-nums">
            {{ footer.detail }}
          </span>
        </div>
        <a
          v-if="amountView.notice?.kind === 'needs_verification'"
          :href="amountView.notice.verifyUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="primaryClass"
        >
          {{ translate('needsVerification.action') }}
          <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
        </a>
        <a
          v-else-if="amountView.notice?.kind === 'not_verified'"
          :href="supportUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="primaryClass"
        >
          {{ translate('notVerified.action') }}
        </a>
        <button
          v-else
          type="button"
          :class="primaryClass"
          :disabled="!amountView.canContinue"
          :aria-busy="amountView.opening || undefined"
          data-testid="add-credits-continue"
          @click="dialog.continueToCheckout"
        >
          {{
            amountView.opening ? translate('opening') : translate('continue')
          }}
          <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
        </button>
      </div>
    </template>

    <template v-else-if="opened">
      <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
        <p class="m-0 text-muted-foreground">{{ translate('opened.body') }}</p>
        <dl
          :class="
            cn(
              'm-0 flex flex-col gap-1 rounded-lg bg-secondary p-3',
              ui.summary
            )
          "
          data-testid="add-credits-opened-summary"
        >
          <div class="flex justify-between">
            <dt class="text-muted-foreground">
              {{ translate('opened.credits') }}
            </dt>
            <dd class="m-0 tabular-nums">{{ openedCredits }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted-foreground">
              {{ translate('opened.amount') }}
            </dt>
            <dd class="m-0 tabular-nums">
              {{ formatMoney(opened.amountCents) }}
            </dd>
          </div>
        </dl>
        <div
          v-if="opened.refusal"
          role="alert"
          class="flex gap-2 rounded-lg border border-solid border-warning/60 bg-warning/10 p-3"
        >
          <i
            class="mt-0.5 icon-[lucide--circle-alert] text-warning"
            aria-hidden="true"
          />
          <span>{{ translate('checkoutFailed.title') }}</span>
        </div>
      </div>
      <div
        :class="
          cn(
            'flex items-center justify-end gap-2 border-t border-solid px-4 py-4',
            ui.footer
          )
        "
      >
        <button
          type="button"
          :class="
            cn(
              buttonVariants({ variant: 'muted-textonly', size: 'lg' }),
              ui.secondary
            )
          "
          :disabled="!canTopUp || dialog.state.value.step === 'opening'"
          data-testid="add-credits-reopen"
          @click="dialog.reopenCheckout"
        >
          {{ translate('opened.reopen') }}
          <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
        </button>
        <button
          type="button"
          :class="
            cn(
              buttonVariants({ variant: 'secondary', size: 'lg' }),
              ui.secondary
            )
          "
          @click="emit('close')"
        >
          {{ translate('close') }}
        </button>
      </div>
    </template>

    <template v-else-if="blocked">
      <div :class="cn('p-4', ui.body)">
        <p class="m-0 text-muted-foreground">{{ translate('blocked.body') }}</p>
      </div>
      <div
        :class="
          cn(
            'flex items-center justify-end border-t border-solid px-4 py-4',
            ui.footer
          )
        "
      >
        <a
          v-if="blocked.checkoutUrl"
          :href="blocked.checkoutUrl"
          target="_blank"
          rel="noopener noreferrer"
          :class="primaryClass"
          data-testid="add-credits-open-checkout"
          @click="dialog.followBlockedLink"
        >
          {{ translate('blocked.action') }}
          <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
        </a>
        <button
          v-else
          type="button"
          :class="primaryClass"
          disabled
          aria-busy="true"
        >
          {{ translate('opening') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import type { Component } from 'vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'

import type {
  AddCreditsCopyKey,
  AddCreditsPendingTopup,
  AddCreditsPlanLine,
  AddCreditsRefusal,
  AddCreditsTranslate,
  CapabilityDenialReason
} from '@comfyorg/account-core/billing'
import {
  ADD_CREDITS_FALLBACK_BOUNDS,
  ADD_CREDITS_PRESETS_CENTS,
  addCreditsRefusalForDenial,
  addCreditsWait,
  amountErrorCopyKey,
  initialAddCreditsAmount,
  translateAddCreditsDefault,
  waitCopy
} from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsPorts } from './useAddCreditsDialog'
import { useAddCreditsDialog } from './useAddCreditsDialog'

type UiSlot =
  | 'root'
  | 'header'
  | 'title'
  | 'close'
  | 'body'
  | 'presets'
  | 'preset'
  | 'line'
  | 'field'
  | 'error'
  | 'notice'
  | 'summary'
  | 'footer'
  | 'primary'
  | 'secondary'

const {
  ports,
  canTopUp,
  topUpDenial,
  minTopupCents,
  maxTopupCents,
  suggestedTopupCents,
  negativeBalanceCredits,
  pendingTopup,
  planLine,
  opensIn = 'tab',
  supportUrl,
  locale,
  translate = translateAddCreditsDefault,
  titleAs = 'h2',
  ui = {}
} = defineProps<{
  ports: AddCreditsPorts
  canTopUp: boolean
  topUpDenial?: CapabilityDenialReason
  minTopupCents?: number
  maxTopupCents?: number
  suggestedTopupCents?: number | null
  negativeBalanceCredits?: number
  pendingTopup?: AddCreditsPendingTopup
  planLine?: AddCreditsPlanLine
  opensIn?: 'tab' | 'browser'
  supportUrl: string
  locale: string
  translate?: AddCreditsTranslate
  titleAs?: string | Component
  ui?: Partial<Record<UiSlot, string>>
}>()

const emit = defineEmits<{ close: [] }>()

const SUPPORT_TOKEN = '{support}'

const dialog = useAddCreditsDialog({
  ports,
  initialAmount: initialAddCreditsAmount(suggestedTopupCents),
  facts: () => ({
    bounds: {
      minCents: minTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.minCents,
      maxCents: maxTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.maxCents
    },
    canTopUp,
    canTopUpRefusal: addCreditsRefusalForDenial(topUpDenial),
    ...(pendingTopup === undefined ? {} : { pendingTopup })
  }),
  onLanded: () => emit('close')
})

const fieldId = useId()
const errorId = useId()

const amountView = computed(() => dialog.amountView.value)
const opened = computed(() =>
  dialog.state.value.step === 'checkout_opened' ? dialog.state.value : undefined
)
const blocked = computed(() => {
  const state = dialog.state.value
  if (state.step === 'checkout_blocked') return state
  if (state.step === 'opening' && !state.tabReserved) {
    return { checkoutUrl: undefined }
  }
  return undefined
})

const title = computed(() => {
  if (opened.value) {
    return translate(
      opensIn === 'browser' ? 'opened.titleBrowser' : 'opened.title'
    )
  }
  if (blocked.value) return translate('blocked.title')
  return translate('title')
})

const selectedPreset = computed(() => {
  const amount = amountView.value?.amount
  return amount?.kind === 'preset' ? String(amount.cents) : undefined
})
const customInput = computed(() => {
  const amount = amountView.value?.amount
  return amount?.kind === 'custom' ? amount.input : ''
})

function pickPreset(value: unknown) {
  if (typeof value === 'string') dialog.pickPreset(Number(value))
}

function onInput(event: Event) {
  if (event.target instanceof HTMLInputElement) {
    dialog.typeAmount(event.target.value)
  }
}

const money = computed(
  () =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
)
const dollars = computed(
  () =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
)
const count = computed(() => new Intl.NumberFormat(locale))

const formatMoney = (cents: number) => money.value.format(cents / 100)
const formatDollars = (cents: number) =>
  cents % 100 === 0 ? dollars.value.format(cents / 100) : formatMoney(cents)
const formatCredits = (credits: number) => count.value.format(credits)

const amountError = computed(() => {
  const check = amountView.value?.check
  if (check?.status !== 'invalid') return undefined
  const bound =
    check.error === 'below_min'
      ? (minTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.minCents)
      : (maxTopupCents ?? ADD_CREDITS_FALLBACK_BOUNDS.maxCents)
  return translate(amountErrorCopyKey(check.error), {
    amount: formatDollars(bound)
  })
})

const creditsText = computed(() => {
  const quote = dialog.quote.value
  if (quote === undefined) return translate('credits', { credits: 0 })
  if (quote.status === 'loading') return 'loading' as const
  if (quote.status === 'unavailable') return translate('creditsUnavailable')
  return translate('credits', { credits: formatCredits(quote.credits) })
})

const openedCredits = computed(() => {
  const quote = dialog.quote.value
  return quote?.status === 'ok' ? formatCredits(quote.credits) : '—'
})

const footer = computed(() => {
  const view = amountView.value
  const notice = view?.notice
  const cents = view?.amountCents
  if (notice?.kind === 'not_verified') {
    return {
      credits:
        cents === undefined
          ? translate('notVerified.footer')
          : translate('notVerified.footerTitle', {
              amount: formatMoney(cents)
            }),
      detail: cents === undefined ? '' : translate('notVerified.footer')
    }
  }
  const amount = formatMoney(cents ?? 0)
  return {
    credits: creditsText.value,
    detail:
      notice?.kind === 'needs_verification'
        ? translate('needsVerification.footer', { amount })
        : translate('paidAtCheckout', { amount })
  }
})

type NoticeCopy = {
  tone: 'warning' | 'neutral'
  title: string
  body: string[]
}

const REFUSAL_COPY: Record<
  AddCreditsRefusal['kind'],
  readonly [AddCreditsCopyKey, AddCreditsCopyKey]
> = {
  checkout_failed: ['checkoutFailed.title', 'checkoutFailed.body'],
  not_allowed: ['notAllowed.title', 'notAllowed.body'],
  rate_limited: ['rateLimited.title', 'rateLimited.body'],
  purchases_paused: ['purchasesPaused.title', 'purchasesPaused.body']
}

function splitSupport(text: string): string[] {
  return text.split(/(\{support\})/).filter((part) => part !== '')
}

function pendingTitle(
  pending: AddCreditsPendingTopup,
  withAmount: AddCreditsCopyKey,
  withoutAmount: AddCreditsCopyKey
) {
  return pending.amountCents === undefined
    ? translate(withoutAmount)
    : translate(withAmount, { amount: formatDollars(pending.amountCents) })
}

const noticeCopy = computed<NoticeCopy | undefined>(() => {
  const notice = amountView.value?.notice
  if (!notice) return undefined
  switch (notice.kind) {
    case 'refusal': {
      const [titleKey, bodyKey] = REFUSAL_COPY[notice.refusal.kind]
      const wait =
        notice.refusal.kind === 'rate_limited'
          ? addCreditsWait(notice.refusal.retryAfterSeconds)
          : undefined
      const body =
        wait === undefined
          ? translate(bodyKey, { support: SUPPORT_TOKEN })
          : wait.unit === 'later'
            ? translate('rateLimited.bodyNoWait', { support: SUPPORT_TOKEN })
            : translate(bodyKey, {
                wait: waitCopy(wait, translate),
                support: SUPPORT_TOKEN
              })
      return {
        tone: 'warning',
        title: translate(titleKey),
        body: splitSupport(body)
      }
    }
    case 'processing':
      return {
        tone: 'neutral',
        title: pendingTitle(
          notice,
          'processing.title',
          'processing.titleNoAmount'
        ),
        body: [translate('processing.body')]
      }
    case 'needs_verification':
      return {
        tone: 'neutral',
        title: pendingTitle(
          notice,
          'needsVerification.title',
          'needsVerification.titleNoAmount'
        ),
        body: [translate('needsVerification.body')]
      }
    case 'not_verified':
      return {
        tone: 'neutral',
        title: pendingTitle(
          notice,
          'notVerified.title',
          'notVerified.titleNoAmount'
        ),
        body: [translate('notVerified.body')]
      }
  }
  return undefined
})

const noticeKind = computed(() => {
  const notice = amountView.value?.notice
  return notice?.kind === 'refusal' ? notice.refusal.kind : notice?.kind
})

const primaryClass = computed(() =>
  cn(
    buttonVariants({ variant: 'inverted', size: 'lg' }),
    'shrink-0 no-underline',
    ui.primary
  )
)
</script>
