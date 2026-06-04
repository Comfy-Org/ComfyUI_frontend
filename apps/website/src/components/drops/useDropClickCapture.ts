import posthog from 'posthog-js'

export function captureDropClick(
  location: string,
  properties: Record<string, unknown> = {}
): void {
  try {
    posthog.capture('drops_cta_clicked', { location, ...properties })
  } catch (error) {
    console.error('PostHog capture failed', error)
  }
}
