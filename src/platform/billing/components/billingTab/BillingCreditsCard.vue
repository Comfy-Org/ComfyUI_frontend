<template>
  <section class="flex flex-col gap-3" data-testid="billing-credits-card">
    <h3
      class="m-0 flex items-center gap-1.5 text-base font-medium text-foreground"
    >
      {{ $t('workspacePanel.billingTab.credits.title') }}
      <Button
        :tooltip="
          $t('workspacePanel.billingTab.credits.rateTooltip', {
            credits: CREDITS_PER_USD
          })
        "
        :aria-label="$t('workspacePanel.billingTab.credits.rateInfo')"
        variant="muted-textonly"
        size="icon-sm"
      >
        <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
      </Button>
    </h3>

    <div
      class="flex flex-col rounded-xl border border-card"
      data-testid="billing-credits-surface"
    >
      <div class="flex items-start justify-between gap-4 px-5 py-4">
        <div class="flex min-w-0 flex-col gap-2">
          <span class="text-sm text-muted-foreground">
            {{ $t('workspacePanel.billingTab.credits.available') }}
          </span>
          <span
            :class="
              cn(
                'text-2xl font-medium text-foreground',
                state.kind === 'unavailable' && 'text-muted-foreground'
              )
            "
            data-testid="billing-credits-available"
          >
            {{
              state.kind === 'unavailable' ? '—' : credits(state.availableCents)
            }}
          </span>
          <p
            v-if="state.kind === 'unavailable'"
            class="m-0 flex items-center gap-1 text-sm text-muted-foreground"
            role="alert"
          >
            {{ $t('workspacePanel.billingTab.credits.unavailable') }}
            <Button variant="link" size="sm" @click="emit('retry')">
              {{ $t('workspacePanel.billingTab.tryAgain') }}
            </Button>
          </p>
          <p
            v-else-if="overdrawnCredits > 0"
            class="m-0 text-sm text-muted-foreground"
          >
            {{
              $t(
                'workspacePanel.billingTab.credits.overdrawn',
                { count: credits(-state.availableCents) },
                overdrawnCredits
              )
            }}
          </p>
          <p
            v-if="planCreditNote"
            class="m-0 text-sm text-muted-foreground"
            data-testid="billing-credits-plan-note"
          >
            {{ planCreditNote }}
          </p>
        </div>
        <div
          v-if="state.kind === 'noPlan' && addCredits.kind !== 'hidden'"
          class="flex max-w-56 shrink-0 flex-col items-end gap-1"
        >
          <AddCreditsButton
            :availability="addCredits"
            :reason-id="refusalReasonId"
            :variant="addCreditsVariant"
            size="md"
            @click="emit('addCredits')"
          >
            {{ $t('workspacePanel.billingTab.credits.addCredits') }}
          </AddCreditsButton>
          <AddCreditsRefusalReason
            :availability="addCredits"
            :reason-id="refusalReasonId"
            class="m-0 text-right text-xs text-muted-foreground"
          />
        </div>
      </div>

      <div v-if="state.kind === 'plan'" class="flex border-t border-card">
        <BillingCreditsPlanCell :plan="state" />
        <div class="flex flex-1 items-start justify-between gap-4 px-5 py-4">
          <div class="flex flex-col gap-2">
            <span class="flex items-center gap-1 text-sm text-muted-foreground">
              {{ $t('workspacePanel.billingTab.credits.topUp') }}
              <Button
                :tooltip="$t('workspacePanel.billingTab.credits.topUpTooltip')"
                :aria-label="
                  $t('workspacePanel.billingTab.credits.topUpTooltip')
                "
                variant="muted-textonly"
                size="icon-sm"
              >
                <i class="icon-[lucide--info] size-3.5" aria-hidden="true" />
              </Button>
            </span>
            <span
              class="text-sm font-semibold text-foreground"
              data-testid="billing-credits-top-up"
            >
              {{ credits(state.topUpCents) }}
            </span>
            <span v-if="state.topUpInUse" class="text-xs text-muted-foreground">
              {{ $t('workspacePanel.billingTab.credits.inUse') }}
            </span>
          </div>
          <div
            v-if="addCredits.kind !== 'hidden'"
            class="flex max-w-56 shrink-0 flex-col items-end gap-1"
          >
            <AddCreditsButton
              :availability="addCredits"
              :reason-id="refusalReasonId"
              :variant="addCreditsVariant"
              size="md"
              @click="emit('addCredits')"
            >
              {{ $t('workspacePanel.billingTab.credits.addCredits') }}
            </AddCreditsButton>
            <AddCreditsRefusalReason
              :availability="addCredits"
              :reason-id="refusalReasonId"
              class="m-0 text-right text-xs text-muted-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  CREDITS_PER_USD,
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import Button from '@comfyorg/design-system/button/Button'
import AddCreditsButton from '@/platform/billing/components/AddCreditsButton.vue'
import AddCreditsRefusalReason from '@/platform/billing/components/AddCreditsRefusalReason.vue'
import BillingCreditsPlanCell from '@/platform/billing/components/billingTab/BillingCreditsPlanCell.vue'
import type { CreditsCardState } from '@/platform/billing/components/billingTab/creditsCard'
import type { AddCreditsAvailability } from '@/platform/billing/addCreditsAvailability'

const {
  state,
  addCredits,
  planCreditNote,
  addCreditsVariant = 'secondary'
} = defineProps<{
  state: CreditsCardState
  addCredits: AddCreditsAvailability
  planCreditNote: string | null
  addCreditsVariant?: 'secondary' | 'inverted'
}>()

const emit = defineEmits<{
  retry: []
  addCredits: []
}>()

const { locale } = useI18n()

const refusalReasonId = useId()

const WHOLE = { maximumFractionDigits: 0 }

function credits(cents: number) {
  return formatCreditsFromCents({
    cents,
    locale: locale.value,
    numberOptions: WHOLE
  })
}

const overdrawnCredits = computed(() =>
  state.kind === 'unavailable' ? 0 : centsToCredits(-state.availableCents)
)
</script>
