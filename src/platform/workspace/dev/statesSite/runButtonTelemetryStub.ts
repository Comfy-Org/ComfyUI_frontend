/**
 * Build-time replacement for `@/composables/useRunButtonTelemetry` in the
 * states viewer (wired via alias in vite.states.config.mts). The real one reads
 * the ComfyApp graph, which the viewer never initializes — so the Run button's
 * click handler threw before reaching `showSubscriptionDialog`, and the shipped
 * run-lock dialogs never opened.
 */
export function getRunButtonTelemetryProperties() {
  return {}
}

export function useRunButtonTelemetry() {
  return { trackRunButton: () => {} }
}
