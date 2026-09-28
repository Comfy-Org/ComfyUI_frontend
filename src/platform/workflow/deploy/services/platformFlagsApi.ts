import { z } from 'zod'

import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import type { AuthHeader } from '@/types/authTypes'

const DISTRIBUTIONS_FLAG_PATH = '/api/flags/distributions-enabled'
const zDistributionsFlag = z.object({ enabled: z.boolean() })

/**
 * The route (DPLAT-1825) verifies the user from a Firebase bearer, so an API
 * key login cannot be asked.
 */
export async function fetchDistributionsEnabled(
  getAuthHeader: () => Promise<AuthHeader | null>
): Promise<boolean> {
  try {
    const header = await getAuthHeader()
    if (!header || !('Authorization' in header)) return false
    const response = await fetch(
      new URL(DISTRIBUTIONS_FLAG_PATH, getComfyPlatformBaseUrl()),
      { headers: header }
    )
    if (!response.ok) return false
    const answer = zDistributionsFlag.safeParse(await response.json())
    return answer.success && answer.data.enabled
  } catch {
    return false
  }
}
