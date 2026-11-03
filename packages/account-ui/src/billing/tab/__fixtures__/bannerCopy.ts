import type { BillingBannerCopy } from '#/billing/tab/billingBannerView'

export const billingBannerCopy: BillingBannerCopy = {
  dismiss: 'Dismiss',
  actions: {
    addCredits: 'Add credits',
    updatePayment: 'Update payment',
    verifyPayment: 'Complete verification',
    contactSupport: 'Contact support'
  },
  planCheckout: {
    verifyPayment: {
      title: 'Verify your payment',
      body: 'Your bank requires additional verification to complete this payment.'
    },
    paymentReceived: {
      title: 'Payment received',
      body: "Your plan is activating. You won't be charged again."
    }
  },
  topupCheckout: {
    failedTitle: (cents) =>
      cents === null
        ? "Your top-up didn't go through"
        : `Your $${cents / 100} top-up didn't go through`,
    failedBody:
      'No credits were added. Try again or use a different payment method.',
    creditsApplying: {
      title: 'Payment received',
      body: "Your credits are being added. You won't be charged again."
    },
    processing: {
      title: 'Payment processing',
      body: "Your bank is confirming the payment. Credits are added once it clears, so you don't need to pay again."
    }
  }
}
