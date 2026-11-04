<template>
  <DefineAddCredits>
    <slot
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
  </DefineAddCredits>
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
        <BillingInfoTip :text="copy.rateTooltip" :label="copy.rateInfo" />
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
          <BillingCreditsBalance
            :state
            :plan-credit-note="planCreditNote"
            :copy
            :locale
            :classes="{ available: classes?.available, note: classes?.note }"
            @retry="emit('retry')"
          >
            <template v-if="$slots.retry" #retry="{ label }">
              <slot name="retry" :label />
            </template>
          </BillingCreditsBalance>
          <ReuseAddCredits v-if="state.kind === 'noPlan' && showAddCredits" />
        </div>

        <div v-if="state.kind === 'plan'" class="flex border-t border-card">
          <BillingCreditsPlanCell
            :plan="state"
            :copy
            :locale
            :classes="{ root: classes?.planCell, meter: classes?.planMeter }"
          />
          <BillingCreditsTopUpCell
            :top-up-cents="state.topUpCents"
            :top-up-in-use="state.topUpInUse"
            :copy
            :locale
            :root-class="classes?.topUpCell"
          >
            <ReuseAddCredits v-if="showAddCredits" />
          </BillingCreditsTopUpCell>
        </div>
      </div>
    </section>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { createReusableTemplate } from '@vueuse/core'
import { computed } from 'vue'

import type {
  AddCreditsAvailability,
  CreditsCardState
} from '@comfyorg/account-core/billing'
import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import { cn } from '@comfyorg/tailwind-utils'

import BillingInfoTip from './BillingInfoTip.vue'
import AddCreditsAction from './AddCreditsAction.vue'
import BillingCreditsBalance from './BillingCreditsBalance.vue'
import BillingCreditsPlanCell from './BillingCreditsPlanCell.vue'
import BillingCreditsTopUpCell from './BillingCreditsTopUpCell.vue'
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

const [DefineAddCredits, ReuseAddCredits] = createReusableTemplate()

const showAddCredits = computed(() => addCredits.kind !== 'hidden')

const addCreditsReason = computed(() =>
  addCredits.kind === 'disabled'
    ? copy.addCreditsReason(addCredits.reasonKey)
    : null
)
</script>
