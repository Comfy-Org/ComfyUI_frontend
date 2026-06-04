import posthog from 'posthog-js'

export function captureDropClick(
  location: string,
  properties: Record<string, unknown> = {}
): void {
  try {
    posthog.capture('drops_cta_clicked', { ...properties, location })
  } catch (error) {
    console.error('PostHog capture failed', error)
  }
}
