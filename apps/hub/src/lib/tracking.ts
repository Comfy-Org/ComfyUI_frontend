/**
 * Minimal event tracking using Vercel Analytics
 */

export function trackEvent(name: string, properties?: Record<string, string>) {
  if (typeof window !== 'undefined') {
    const va = (
      window as {
        va?: (command: string, payload: Record<string, unknown>) => void
      }
    ).va
    if (va) {
      va('event', { name, ...properties })
    }
  }
}
