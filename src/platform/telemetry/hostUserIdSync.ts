import { watch } from 'vue'
import type { WatchStopHandle } from 'vue'

import { useAuthStore } from '@/stores/authStore'

function safelyReportFirebaseAuthState(report: () => void): void {
  try {
    report()
  } catch {
    // A host bridge failure must not block renderer startup or Firebase auth.
  }
}

/**
 * Keep the Desktop main-process telemetry identity aligned with Firebase auth.
 * Must run after Pinia and VueFire are installed.
 */
export function syncHostUserIdWithFirebaseAuth(): WatchStopHandle | undefined {
  const telemetry = window.__comfyDesktop2?.Telemetry
  if (!telemetry) return

  // Register this Cloud renderer before Firebase resolves. Desktop may host
  // multiple Cloud main frames whose isolated browser partitions have
  // different auth states, so main owns all cross-WebContents arbitration.
  safelyReportFirebaseAuthState(() =>
    telemetry.reportFirebaseAuthState?.({ status: 'pending' })
  )

  const authStore = useAuthStore()

  return watch(
    () =>
      authStore.isInitialized
        ? (authStore.currentUser?.uid ?? null)
        : undefined,
    (userId) => {
      if (userId === undefined) return

      safelyReportFirebaseAuthState(() =>
        telemetry.reportFirebaseAuthState?.(
          userId === null
            ? { status: 'signed_out' }
            : { status: 'signed_in', userId }
        )
      )
    },
    { immediate: true }
  )
}
