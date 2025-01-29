import axios from 'axios'

import { electronAPI } from './envUtil'
import { isValidUrl } from './formatUtil'

const VALID_STATUS_CODES = [200, 201, 301, 302, 307, 308]
export const checkUrlReachable = async (url: string): Promise<boolean> => {
  try {
    const response = await axios.head(url)
    // Additional check for successful response
    return VALID_STATUS_CODES.includes(response.status)
  } catch {
    return false
  }
}

/**
 * Check if a mirror is reachable from the electron App.
 * @param mirror - The mirror to check.
 * @returns True if the mirror is reachable, false otherwise.
 */
export const checkMirrorReachable = async (mirror: string) => {
  return (
    isValidUrl(mirror) && (await electronAPI().NetWork.canAccessUrl(mirror))
  )
}
