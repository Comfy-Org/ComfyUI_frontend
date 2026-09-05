import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'
import { billingCopyKeys, createBillingCopy } from '../core/index.js'
import type { BillingState, BillingStep, ReasonKey } from '../core/index.js'

export const CheckoutSteps = defineComponent({
  name: 'CheckoutSteps',
  props: {
    step: { type: String as PropType<BillingStep>, required: true },
    reason: { type: String as PropType<ReasonKey>, required: false },
    copy: {
      type: Object as PropType<Readonly<Record<string, string>>>,
      required: false
    },
    noChargeConfirmed: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  emits: ['select', 'cancel', 'retry', 'open-portal'],
  setup(props, { emit, slots }) {
    return () => {
      const state: BillingState = {
        step: props.step,
        reasonKey: props.reason,
        noChargeConfirmed: props.noChargeConfirmed
      }
      const keys = billingCopyKeys(state)
      const copy = createBillingCopy(props.copy)
      const header =
        slots.header?.({ state, key: keys.header, text: copy[keys.header] }) ??
        h('h2', { 'data-copy-key': keys.header }, copy[keys.header])
      const body =
        slots.body?.({ state, key: keys.body, text: copy[keys.body] }) ??
        h('p', { 'data-copy-key': keys.body }, copy[keys.body])
      const safety = keys.safety
        ? h('p', { 'data-copy-key': keys.safety }, copy[keys.safety])
        : undefined
      const actions = slots.actions?.({
        state,
        disabled: props.disabled,
        select: () => emit('select'),
        cancel: () => emit('cancel'),
        retry: () => emit('retry'),
        openPortal: () => emit('open-portal')
      })
      return h(
        'section',
        { 'data-billing-step': props.step, 'aria-label': props.step },
        [header, body, safety, actions]
      )
    }
  }
})
