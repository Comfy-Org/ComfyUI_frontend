import { reportError } from '@comfyorg/telemetry/reportError'

export function extensionNameFromPath(path: string): string {
  const encodedName = path.split('/').filter(Boolean).at(-1) ?? path
  try {
    return decodeURIComponent(encodedName)
  } catch {
    return encodedName
  }
}

export function normalizeDisabledExtensionPaths(value: unknown): string[] {
  if (value === undefined) return []
  if (
    Array.isArray(value) &&
    value.every((path): path is string => typeof path === 'string')
  ) {
    return value
  }

  reportError(
    new TypeError('Disabled extension paths must be an array of strings'),
    {
      errorType: 'invalid_extension_path_setting',
      surface: 'platform',
      level: 'warning'
    }
  )
  return []
}
