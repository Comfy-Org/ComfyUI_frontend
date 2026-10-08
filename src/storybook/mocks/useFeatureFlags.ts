/**
 * Storybook mock for `useFeatureFlags`.
 *
 * The real composable resolves flags from authenticated remote config, which is
 * unavailable in Storybook. This stub enables billing controls.
 */
export function useFeatureFlags() {
  return {
    flags: {
      billingControlEnabled: true,
      hostedBillingDestination: 'stripe',
      hostedBillingWebEnabled: false,
      v1PaymentRecovery: true
    }
  }
}
