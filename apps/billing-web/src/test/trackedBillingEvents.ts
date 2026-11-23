import { billingWebTelemetry } from '@/telemetry/billingWebTelemetry'

/** Replaces the telemetry sink for one test and reads back the events it was handed. */
export function trackedBillingEvents() {
  const track = vi
    .spyOn(billingWebTelemetry, 'trackBillingEvent')
    .mockImplementation(() => undefined)
  return () => track.mock.calls.map(([event]) => event)
}
