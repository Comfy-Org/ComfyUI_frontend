<template>
  <TooltipProvider>
    <section
      :class="cn('flex flex-col gap-3', classes?.root)"
      data-testid="billing-credits-card"
    >
      <h3
        :class="
          cn(
            'm-0 flex items-center gap-1.5 text-base font-medium text-foreground',
            classes?.title
          )
        "
      >
        {{ copy.title }}
        <TextTooltip :text="copy.rateTooltip">
          <CheckoutButton
            :aria-label="copy.rateInfo"
            variant="muted-textonly"
            size="icon-sm"
          >
            <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
          </CheckoutButton>
        </TextTooltip>
      </h3>

      <div
        :class="
          cn('flex flex-col rounded-xl border border-card', classes?.surface)
        "
        data-testid="billing-credits-surface"
      >
        <div
          :class="
            cn(
              'flex items-start justify-between gap-4 px-5 py-4',
              classes?.balance
            )
          "
        >
          <div class="flex min-w-0 flex-col gap-2">
            <span class="text-sm text-muted-foreground">
              {{ copy.available }}
            </span>
            <span
              :class="
                cn(
                  'text-2xl font-medium text-foreground',
                  state.kind === 'unavailable' && 'text-muted-foreground',
                  classes?.available
                )
              "
              data-testid="billing-credits-available"
            >
              {{
                state.kind === 'unavailable'
                  ? '—'
                  : credits(state.availableCents)
              }}
            </span>
            <p
              v-if="state.kind === 'unavailable'"
              :class="
                cn(
                  'm-0 flex items-center gap-1 text-sm text-muted-foreground',
                  classes?.note
                )
              "
              role="alert"
            >
              {{ copy.unavailable }}
              <slot name="retry" :label="copy.tryAgain">
                <CheckoutButton variant="link" size="sm" @click="emit('retry')">
                  {{ copy.tryAgain }}
                </CheckoutButton>
              </slot>
            </p>
            <p
              v-else-if="overdrawnCredits > 0"
              :class="cn('m-0 text-sm text-muted-foreground', classes?.note)"
            >
              {{
                copy.overdrawn(
                  formatWholeCredits(overdrawnCredits, locale),
                  overdrawnCredits
                )
              }}
            </p>
            <p
              v-if="planCreditNote"
              :class="cn('m-0 text-sm text-muted-foreground', classes?.note)"
              data-testid="billing-credits-plan-note"
            >
              {{ planCreditNote }}
            </p>
          </div>
          <slot
            v-if="state.kind === 'noPlan' && addCredits.kind !== 'hidden'"
            name="addCreditsAction"
            :availability="addCredits"
            :label="copy.addCredits"
            :reason="addCreditsReason"
            :variant="addCreditsVariant"
          >
            <AddCreditsAction
              :availability="addCredits"
              :reason="addCreditsReason"
              :variant="addCreditsVariant"
              size="md"
              :class="
                cn(
                  'flex max-w-56 shrink-0 flex-col items-end gap-1',
                  classes?.addCredits
                )
              "
              reason-class="text-right text-xs"
              @click="emit('addCredits')"
            >
              {{ copy.addCredits }}
            </AddCreditsAction>
          </slot>
        </div>

        <div v-if="state.kind === 'plan'" class="flex border-t border-card">
          <BillingCreditsPlanCell
            :plan="state"
            :copy
            :locale
            :classes="{ root: classes?.planCell, meter: classes?.planMeter }"
          />
          <div
            :class="
              cn(
                'flex flex-1 items-start justify-between gap-4 px-5 py-4',
                classes?.topUpCell
              )
            "
          >
            <div class="flex flex-col gap-2">
              <span
                class="flex items-center gap-1 text-sm text-muted-foreground"
              >
                {{ copy.topUp }}
                <TextTooltip :text="copy.topUpTooltip">
                  <CheckoutButton
                    :aria-label="copy.topUpTooltip"
                    variant="muted-textonly"
                    size="icon-sm"
                  >
                    <i
                      class="icon-[lucide--info] size-3.5"
                      aria-hidden="true"
                    />
                  </CheckoutButton>
                </TextTooltip>
              </span>
              <span
                class="text-sm font-semibold text-foreground"
                data-testid="billing-credits-top-up"
              >
                {{ credits(state.topUpCents) }}
              </span>
              <span
                v-if="state.topUpInUse"
                class="text-xs text-muted-foreground"
              >
                {{ copy.inUse }}
              </span>
            </div>
            <slot
              v-if="addCredits.kind !== 'hidden'"
              name="addCreditsAction"
              :availability="addCredits"
              :label="copy.addCredits"
              :reason="addCreditsReason"
              :variant="addCreditsVariant"
            >
              <AddCreditsAction
                :availability="addCredits"
                :reason="addCreditsReason"
                :variant="addCreditsVariant"
                size="md"
                :class="
                  cn(
                    'flex max-w-56 shrink-0 flex-col items-end gap-1',
                    classes?.addCredits
                  )
                "
                reason-class="text-right text-xs"
                @click="emit('addCredits')"
              >
                {{ copy.addCredits }}
              </AddCreditsAction>
            </slot>
          </div>
        </div>
      </div>
    </section>
  </TooltipProvider>
</template>

<script setup lang="ts">
/**
 * The Billing tab Credits card for a served balance. Retry and Add credits are
 * emitted; the host reloads the balance or opens the top-up.
 */
import { computed } from 'vue'

import type {
  AddCreditsAvailability,
  CreditsCardState
} from '@comfyorg/account-core/billing'
import TextTooltip from '@comfyorg/design-system/tooltip/TextTooltip'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'

import AddCreditsAction from './AddCreditsAction.vue'
import BillingCreditsPlanCell from './BillingCreditsPlanCell.vue'
import { centsToCredits, formatWholeCredits } from './creditsCardCopy'
import type { CreditsCardCopy } from './creditsCardCopy'

type CreditsCardPart =
  | 'root'
  | 'title'
  | 'surface'
  | 'balance'
  | 'available'
  | 'note'
  | 'addCredits'
  | 'planCell'
  | 'planMeter'
  | 'topUpCell'

const {
  state,
  addCredits,
  planCreditNote,
  copy,
  locale,
  addCreditsVariant = 'secondary',
  classes
} = defineProps<{
  state: CreditsCardState
  addCredits: AddCreditsAvailability
  planCreditNote: string | null
  copy: CreditsCardCopy
  locale: string
  addCreditsVariant?: 'secondary' | 'inverted'
  classes?: Partial<Record<CreditsCardPart, string>>
}>()

const emit = defineEmits<{ retry: []; addCredits: [] }>()

function credits(cents: number) {
  return formatWholeCredits(centsToCredits(cents), locale)
}

const overdrawnCredits = computed(() =>
  state.kind === 'unavailable' ? 0 : centsToCredits(-state.availableCents)
)

const addCreditsReason = computed(() =>
  addCredits.kind === 'disabled'
    ? copy.addCreditsReason(addCredits.reasonKey)
    : null
)
</script>
