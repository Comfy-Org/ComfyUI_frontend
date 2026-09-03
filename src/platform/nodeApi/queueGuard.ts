import { reportError } from '@/platform/telemetry/reportError'

import { ComfyApiError } from './errors'
import type { Unsubscribe } from './widgetHandle'

const guards = new Set<() => boolean | Promise<boolean>>()
const GUARD_TIMEOUT_MS = 5_000

export function registerQueueGuard(
  check: () => boolean | Promise<boolean>
): Unsubscribe {
  guards.add(check)
  return () => guards.delete(check)
}

export async function mayRun(): Promise<boolean> {
  if (!guards.size) return true
  const asked = [...guards].map(async (check) => {
    try {
      return await check()
    } catch (error) {
      reportError(error, { errorType: 'queue_guard_threw' })
      return true
    }
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  const verdicts = await Promise.race([
    Promise.all(asked),
    new Promise<true[]>((resolve) => {
      timeout = setTimeout(() => {
        reportError(
          new ComfyApiError(
            `A queue guard did not settle within ${GUARD_TIMEOUT_MS}ms.`
          ),
          { errorType: 'queue_guard_timeout' }
        )
        resolve([true])
      }, GUARD_TIMEOUT_MS)
    })
  ])
  if (timeout !== undefined) clearTimeout(timeout)
  return verdicts.every((allowed) => allowed)
}
