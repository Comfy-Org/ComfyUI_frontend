import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { api } from '@/scripts/api'

const PREFIX = '[DEPRECATION WARNING]'
const LEGACY_API_PATH_REGEX = /:\s*(\S+?)\.\s+This is likely caused/

let backfilled = false

/**
 * Seed the store from the backend's raw log buffer.
 */
export async function backfillServerDeprecations(): Promise<void> {
  if (backfilled) return
  try {
    const logs = await api.getRawLogs()
    const store = useDeprecationWarningsStore()
    for (const entry of logs.entries) {
      if (!entry.m.includes(PREFIX)) continue
      const path = LEGACY_API_PATH_REGEX.exec(entry.m)?.[1]
      if (path) {
        store.report({
          message: `Legacy API import: ${path}`,
          suggestion:
            'Update the extension that imports this file, or ask its author to migrate.',
          source: 'server'
        })
      } else {
        console.warn(
          'Server deprecation log did not match legacy-API template; falling back to raw line. Update LEGACY_API_PATH_REGEX:',
          entry.m
        )
        store.report({
          message: entry.m.trim(),
          source: 'server'
        })
      }
    }
    backfilled = true
  } catch (err) {
    console.error('Failed to fetch initial server logs for deprecations:', err)
  }
}
