import { authEventHook, userResolvedHook } from '@/stores/authEventBus'

import type { TelemetryProvider } from './types'

export function initAuthTracking(
  getTelemetry: () => TelemetryProvider | null
): void {
  authEventHook.on((event) => {
    const telemetry = getTelemetry()
    if (!telemetry) return

    if (event.type === 'login' || event.type === 'register') {
      telemetry.trackAuth({
        method: event.method,
        is_new_user: event.is_new_user
      })
    }
  })

  userResolvedHook.on((event) => {
    const telemetry = getTelemetry()
    if (!telemetry) return

    telemetry.identify?.(event.userId)
  })
}
