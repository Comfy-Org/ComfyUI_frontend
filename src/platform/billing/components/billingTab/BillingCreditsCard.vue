<template>
  <section class="flex flex-col gap-3" data-testid="billing-credits-card">
    <h3
      class="m-0 flex items-center gap-1.5 text-base font-medium text-foreground"
    >
      {{ $t('workspacePanel.billingTab.credits.title') }}
      <BillingInfoTip
        :text="$t('workspacePanel.billingTab.credits.tooltip')"
        :label="$t('workspacePanel.billingTab.credits.tooltipLabel')"
      />
    </h3>

    <div
      class="flex flex-col rounded-xl border border-border"
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
        <Button
          v-if="state.kind === 'noPlan' && canTopUp"
          :variant="addCreditsVariant"
          size="md"
          class="shrink-0"
          @click="emit('addCredits')"
        >
          {{ $t('workspacePanel.billingTab.credits.addCredits') }}
        </Button>
      </div>

      <div v-if="state.kind === 'plan'" class="flex border-t border-border">
        <BillingCreditsPlanCell :plan="state" />
        <div class="flex flex-1 flex-col gap-2 px-5 py-4">
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-2">
              <span
                class="flex items-center gap-1 text-sm text-muted-foreground"
              >
                {{ $t('workspacePanel.billingTab.credits.topUp') }}
                <BillingInfoTip
                  :text="$t('workspacePanel.billingTab.credits.topUpTooltip')"
                />
              </span>
              <span
                class="text-sm font-semibold text-foreground"
                data-testid="billing-credits-top-up"
              >
                {{ credits(state.topUpCents) }}
              </span>
            </div>
            <Button
              v-if="canTopUp"
              :variant="addCreditsVariant"
              size="md"
              class="shrink-0"
              @click="emit('addCredits')"
            >
              {{ $t('workspacePanel.billingTab.credits.addCredits') }}
            </Button>
          </div>
          <span v-if="state.topUpInUse" class="text-xs text-muted-foreground">
            {{ $t('workspacePanel.billingTab.credits.inUse') }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  centsToCredits,
  formatCreditsFromCents
} from '@/base/credits/comfyCredits'
import Button from '@comfyorg/design-system/button/Button'
import BillingInfoTip from '@/platform/billing/components/billingTab/BillingInfoTip.vue'
import BillingCreditsPlanCell from '@/platform/billing/components/billingTab/BillingCreditsPlanCell.vue'
import type { CreditsCardState } from '@/platform/billing/components/billingTab/creditsCard'

const {
  state,
  canTopUp,
  planCreditNote,
  addCreditsVariant = 'secondary'
} = defineProps<{
  state: CreditsCardState
  canTopUp: boolean
  planCreditNote: string | null
  addCreditsVariant?: 'secondary' | 'inverted'
}>()

const emit = defineEmits<{
  retry: []
  addCredits: []
}>()

const { locale } = useI18n()

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
