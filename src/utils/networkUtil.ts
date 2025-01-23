import axios from 'axios'

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
