import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'

const SERVER_BOOT_ID_FEATURE = 'server_boot_id'

export function bootIdOf(flags: unknown): string | undefined {
  if (!flags || typeof flags !== 'object') return undefined
  const id: unknown = Reflect.get(flags, SERVER_BOOT_ID_FEATURE)
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * True when the connected local server reports a `server_boot_id` feature
 * flag. Always false on cloud.
 */
export function serverReportsBootId(): boolean {
  return !isCloud && bootIdOf(api.serverFeatureFlags.value) !== undefined
}
