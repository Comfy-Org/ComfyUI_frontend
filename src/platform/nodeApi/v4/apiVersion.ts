import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { ApiVersion } from './types'

export const API_VERSION: ApiVersion = Object.freeze([4, 0, 0])

/** See `Comfy.isApiVersionAtLeast`. */
export const isApiVersionAtLeast = (version: string): boolean => {
  const wanted = parseVersion(version)
  for (const [index, part] of wanted.entries()) {
    if (API_VERSION[index] !== part) return API_VERSION[index] > part
  }
  return true
}

function parseVersion(text: unknown): ApiVersion {
  const match = typeof text === 'string' && /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text)
  if (!match) {
    throw invalidArgument(
      'isApiVersionAtLeast',
      'a version written like v4.0.0',
      text
    )
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
