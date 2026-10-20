import { render, screen } from '@testing-library/vue'
import { DialogContent, DialogRoot } from 'reka-ui'
import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import { defineComponent, h } from 'vue'

import CheckoutSubscribeConfirm from './CheckoutSubscribeConfirm.vue'
import CheckoutSuccess from './CheckoutSuccess.vue'
import CheckoutTransitionConfirm from './CheckoutTransitionConfirm.vue'
import { checkoutCopy, creatorPlan, successCopy } from './__fixtures__/copy'
import { exactPreview, plan } from './__fixtures__/preview'

describe('CheckoutTitle', () => {
  it.for<{ step: string; component: Component; props: object; name: string }>([
    {
      step: 'subscribe confirmation',
      component: CheckoutSubscribeConfirm,
      props: {
        plan: creatorPlan,
        copy: checkoutCopy,
        locale: 'en',
        publishableKey: 'pk_test'
      },
      name: checkoutCopy.confirmPayment
    },
    {
      step: 'transition confirmation',
      component: CheckoutTransitionConfirm,
      props: {
        previewData: exactPreview({
          transition_type: 'upgrade',
          current_plan: plan('STANDARD', 'MONTHLY', 2000),
          new_plan: plan('CREATOR', 'MONTHLY', 3500)
        }),
        plan: { name: 'Creator', monthlyCredits: 7400 },
        currentPlanName: 'Standard',
        copy: checkoutCopy,
        locale: 'en',
        subscriptionLoaded: true
      },
      name: checkoutCopy.confirmUpgradeTitle
    },
    {
      step: 'success',
      component: CheckoutSuccess,
      props: { plan: creatorPlan, copy: successCopy, locale: 'en' },
      name: successCopy.allSet
    }
  ])(
    'names the dialog hosting the $step step',
    ({ component, props, name }) => {
      render(
        defineComponent({
          setup: () => () =>
            h(DialogRoot, { open: true }, () =>
              h(DialogContent, { 'aria-describedby': undefined }, () =>
                h(component, props)
              )
            )
        }),
        { global: { stubs: { CheckoutPaymentForm: true } } }
      )

      expect(screen.getByRole('dialog', { name })).toBeTruthy()
    }
  )
})
