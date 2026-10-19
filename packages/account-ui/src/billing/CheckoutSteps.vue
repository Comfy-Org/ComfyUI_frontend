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
      :support-url="supportUrl"
      :retry="() => activate('retry')"
      :cancel="() => activate('cancel')"
      :continue-verification="() => activate('continue_verification')"
    >
      <div v-if="actions.length > 0" :class="actionsClass">
        <template v-for="action in actions" :key="action">
          <a
            v-if="action === 'contact_support'"
            :href="supportUrl"
            :class="actionClass"
            :data-copy-key="ACTION_COPY_KEY[action]"
          >
            {{ text[ACTION_COPY_KEY[action]] }}
          </a>
          <button
            v-else
            type="button"
            :class="actionClass"
            :disabled
            :data-copy-key="ACTION_COPY_KEY[action]"
            @click="activate(action)"
          >
            {{ text[ACTION_COPY_KEY[action]] }}
          </button>
        </template>
      </div>
    </slot>
  </section>
</template>

<script lang="ts">
import type {
  PaymentCopyKey,
  PaymentProjection,
  PaymentStep
} from '@comfyorg/account-core/billing'

/** The customer-facing actions the approved copy names. */
export type PaymentAction =
  | 'retry'
  | 'replace_payment_method'
  | 'contact_support'
  | 'continue_verification'

const STEP_ACTIONS: Readonly<
  Partial<Record<PaymentStep, readonly PaymentAction[]>>
> = {
  verifying: ['continue_verification'],
  declined: ['retry'],
  processing_error: ['retry'],
  canceled: ['retry']
}

const ACTION_COPY_KEY: Readonly<Record<PaymentAction, PaymentCopyKey>> = {
  retry: 'billing.action.retry',
  replace_payment_method: 'billing.action.replace_payment_method',
  contact_support: 'billing.action.contact_support',
  continue_verification: 'billing.action.continue_verification'
}

/** The server's recovery action outranks the step's default offer. */
function paymentActions(
  projection: PaymentProjection
): readonly PaymentAction[] {
  switch (projection.recoveryAction) {
    case 'contact_support':
      return ['contact_support']
    case 'replace_payment_method':
      return ['replace_payment_method']
    case 'retry':
    case 'authenticate_payment':
      return ['retry']
    case undefined:
    default:
      return STEP_ACTIONS[projection.step] ?? []
  }
}

const DEFAULT_SUPPORT_URL = 'mailto:support@comfy.org'
</script>

<script setup lang="ts">
/**
 * The eight payment states as one unstyled section: header, body, the coded
 * reason, the safety line only the projection may unlock, and the actions
 * the step offers. Every string comes from the approved copy table, host
 * overrides by key; nothing the server or the payment provider said can
 * reach the screen. The look comes through the class props, the layout
 * through the slots, and every click stays with the host via the emits,
 * except the contact-support link, which leads to `supportUrl`.
 */
import { computed, useId } from 'vue'

import {
  createPaymentCopy,
  paymentCopyKeys
} from '@comfyorg/account-core/billing'

const {
  projection,
  copy = {},
  disabled = false,
  supportUrl = DEFAULT_SUPPORT_URL,
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
  /** Where the contact-support action leads. */
  supportUrl?: string
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
const actions = computed(() => paymentActions(projection))

function activate(
  action: Exclude<PaymentAction, 'contact_support'> | 'cancel'
) {
  if (disabled) return
  if (action === 'retry' || action === 'replace_payment_method') emit('retry')
  else if (action === 'cancel') emit('cancel')
  else emit('continue-verification')
}
</script>
