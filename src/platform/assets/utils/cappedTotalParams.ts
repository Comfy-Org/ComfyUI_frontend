import { isCloud } from '@/platform/distribution/types'

/** Asks Cloud's asset list for a total that stops at the server's cap. */
export function cappedTotalParams(): { capped_total?: 'true' } {
  return isCloud ? { capped_total: 'true' } : {}
}
