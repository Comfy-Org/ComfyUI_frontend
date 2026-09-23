<template>
  <section
    :class="rootClass"
    :data-billing-step="projection.step"
    :aria-labelledby="headerId"
  >
    <slot
      name="header"
      :projection
      :copy-key="keys.header"
      :text="text[keys.header]"
      :header-id="headerId"
    >
      <h2 :id="headerId" :class="headerClass" :data-copy-key="keys.header">
        {{ text[keys.header] }}
      </h2>
    </slot>
    <slot name="body" :projection :copy-key="keys.body" :text="text[keys.body]">
      <p :class="bodyClass" :data-copy-key="keys.body">
        {{ text[keys.body] }}
      </p>
    </slot>
    <p v-if="keys.reason" :class="reasonClass" :data-copy-key="keys.reason">
      {{ text[keys.reason] }}
    </p>
    <p v-if="keys.safety" :class="safetyClass" :data-copy-key="keys.safety">
      {{ text[keys.safety] }}
    </p>
    <slot
      name="actions"
      :projection
      :disabled
      :actions
      :retry="() => activate('retry')"
      :cancel="() => activate('cancel')"
      :continue-verification="() => activate('continue_verification')"
    >
      <div v-if="actions.length > 0" :class="actionsClass">
        <button
          v-for="action in actions"
          :key="action"
          type="button"
          :class="actionClass"
          :disabled
          :data-copy-key="ACTION_COPY_KEY[action]"
          @click="activate(action)"
        >
          {{ text[ACTION_COPY_KEY[action]] }}
        </button>
      </div>
    </slot>
  </section>
</template>

<script lang="ts">
import type {
  PaymentCopyKey,
  PaymentStep
} from '@comfyorg/account-core/billing'

/** The customer-facing actions the approved copy names. */
export type PaymentAction = 'retry' | 'continue_verification'

const ACTIONS: Readonly<
  Partial<Record<PaymentStep, readonly PaymentAction[]>>
> = {
  verifying: ['continue_verification'],
  declined: ['retry'],
  processing_error: ['retry'],
  canceled: ['retry']
}

const ACTION_COPY_KEY: Readonly<Record<PaymentAction, PaymentCopyKey>> = {
  retry: 'billing.action.retry',
  continue_verification: 'billing.action.continue_verification'
}
</script>

<script setup lang="ts">
import type { PaymentProjection } from '@comfyorg/account-core/billing'
import {
  createPaymentCopy,
  paymentCopyKeys
} from '@comfyorg/account-core/billing'
/**
 * The eight payment states as one unstyled section: header, body, the coded
 * reason, the safety line only the projection may unlock, and the actions
 * the step offers. Every string comes from the approved copy table, host
 * overrides by key; nothing the server or the payment provider said can
 * reach the screen. The look comes through the class props, the layout
 * through the slots, and every click stays with the host via the emits.
 */
import { computed, useId } from 'vue'

const {
  projection,
  copy = {},
  disabled = false,
  rootClass,
  headerClass,
  bodyClass,
  reasonClass,
  safetyClass,
  actionsClass,
  actionClass
} = defineProps<{
  projection: PaymentProjection
  /** Host-localized text by approved key; the safety line is not overridable. */
  copy?: Partial<Record<PaymentCopyKey, string>>
  disabled?: boolean
  rootClass?: string
  headerClass?: string
  bodyClass?: string
  reasonClass?: string
  safetyClass?: string
  actionsClass?: string
  actionClass?: string
}>()

const emit = defineEmits<{
  retry: []
  cancel: []
  'continue-verification': []
}>()

const headerId = useId()
const text = computed(() => createPaymentCopy(copy))
const keys = computed(() => paymentCopyKeys(projection))
const actions = computed(() => ACTIONS[projection.step] ?? [])

function activate(action: PaymentAction | 'cancel') {
  if (disabled) return
  if (action === 'retry') emit('retry')
  else if (action === 'cancel') emit('cancel')
  else emit('continue-verification')
}
</script>
