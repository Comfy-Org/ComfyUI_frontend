<template>
  <section
    :class="
      cn(
        'flex items-start justify-between gap-4 rounded-xl border border-card px-5 py-4',
        classes?.root
      )
    "
    data-testid="billing-plan-row"
  >
    <div class="flex min-w-0 flex-col gap-1">
      <h3
        :class="
          cn(
            'm-0 text-sm font-semibold wrap-break-word text-foreground',
            classes?.title
          )
        "
      >
        {{ text.title }}
      </h3>
      <p
        v-if="text.line"
        :class="
          cn('m-0 text-sm wrap-break-word text-muted-foreground', classes?.line)
        "
        data-testid="billing-plan-line"
      >
        {{ text.line }}
      </p>
    </div>
    <div :class="cn('flex shrink-0 items-center gap-2', classes?.actions)">
      <slot name="leading" />
      <slot
        v-if="action"
        name="action"
        :action
        :label="copy.actions[action]"
        :variant="actionVariant"
      >
        <CheckoutButton
          :variant="actionVariant"
          size="md"
          class="shrink-0"
          @click="emit('action', action)"
        >
          {{ copy.actions[action] }}
          <i
            :class="
              action === 'contactSales'
                ? 'icon-[lucide--external-link]'
                : 'icon-[lucide--arrow-up-right]'
            "
            aria-hidden="true"
          />
        </CheckoutButton>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type {
  PlanRowAction,
  PlanRowState
} from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import CheckoutButton from '#/billing/checkout/CheckoutButton.vue'
import { planRowText } from './planRowCopy'
import type { PlanRowCopy } from './planRowCopy'

type ActionVariant = 'inverted' | 'secondary'

const {
  state,
  action,
  copy,
  locale,
  canManageSubscription,
  salesVariant = 'secondary',
  addCreditsVariant = 'secondary',
  classes
} = defineProps<{
  state: PlanRowState
  action: PlanRowAction | null
  copy: PlanRowCopy
  locale: string
  canManageSubscription: boolean
  salesVariant?: ActionVariant
  addCreditsVariant?: ActionVariant
  classes?: Partial<Record<'root' | 'title' | 'line' | 'actions', string>>
}>()

const emit = defineEmits<{ action: [action: PlanRowAction] }>()

const text = computed(() =>
  planRowText(state, copy, locale, canManageSubscription)
)

const actionVariant = computed<ActionVariant>(() => {
  if (action === 'contactSales') return salesVariant
  return action === 'manage' || addCreditsVariant === 'inverted'
    ? 'secondary'
    : 'inverted'
})
</script>
