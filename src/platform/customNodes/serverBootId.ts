import { api } from '@/scripts/api'

/** Server feature flag that local ComfyUI sets to a new random id on every start. */
const SERVER_BOOT_ID_FEATURE = 'server_boot_id'

export function bootIdOf(flags: unknown): string | undefined {
  if (!flags || typeof flags !== 'object') return undefined
  const id: unknown = Reflect.get(flags, SERVER_BOOT_ID_FEATURE)
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * True when the connected server reports a boot id. The core reconnect refresh
 * then refreshes node definitions once after every real restart, so other
 * restart paths (Manager, the agent) leave the refresh to it.
 */
export function serverReportsBootId(): boolean {
  return bootIdOf(api.serverFeatureFlags.value) !== undefined
}
