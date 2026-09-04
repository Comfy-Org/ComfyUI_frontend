import axios from 'axios'

const BACKOFF_BASE_MS = 1000
const BACKOFF_CAP_MS = 16000

export function getBackoff(retryCount: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, retryCount), BACKOFF_CAP_MS)
}

export function isRetriableError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return true
  if (err.code === 'ERR_CANCELED') return false
  const status = err.response?.status
  if (status == null) return true
  if (status >= 500) return true
  return status === 408 || status === 429
}
