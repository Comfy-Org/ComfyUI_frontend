import { BillingBanner } from '@comfyorg/account-ui/billing'
import { defineComponent, h } from 'vue'
import type { PropType } from 'vue'

import { useCreditBanner } from '@/platform/billing/composables/useCreditBanner'

/** Renders the Billing tab credit banner the way BillingTab wires it. */
export const CreditBannerHarness = defineComponent({
  props: {
    suppressed: { type: Boolean, default: false },
    addCreditsVariant: {
      type: String as PropType<'secondary' | 'inverted'>,
      default: 'secondary'
    }
  },
  setup(props) {
    const banner = useCreditBanner(() => props.suppressed)
    return () =>
      banner.view.value &&
      h(BillingBanner, {
        view: banner.view.value,
        copy: banner.copy.value,
        loading: banner.isUpdatingPayment.value,
        addCreditsVariant: props.addCreditsVariant,
        onAction: banner.act,
        onDismiss: banner.dismiss
      })
  }
})
