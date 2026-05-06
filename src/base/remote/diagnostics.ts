import axios from 'axios'

const PAYLOAD_KEY_SAMPLE = 10

export function summarizeError(err: unknown): Record<string, unknown> {
  if (axios.isAxiosError(err)) {
    return {
      message: err.message,
      code: err.code,
      status: err.response?.status
    }
  }
  if (err instanceof Error) {
    return { message: err.message, name: err.name }
  }
  return { message: String(err) }
}

export function summarizePayload(data: unknown): Record<string, unknown> {
  if (data === null) return { type: 'null' }
  if (data === undefined) return { type: 'undefined' }
  if (Array.isArray(data)) return { type: 'array', length: data.length }
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>)
    return {
      type: 'object',
      keys: keys.slice(0, PAYLOAD_KEY_SAMPLE),
      keyCount: keys.length
    }
  }
  return { type: typeof data }
}
