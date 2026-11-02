const FIRST_PARTY_EXTENSION_FOLDERS = new Set(['cloud', 'core'])

export type TelemetryErrorOrigin =
  | { origin: 'first_party' }
  | { origin: 'extension'; extension: string }
  | { origin: 'third_party' }

export function classifyTelemetryErrorOrigin(
  stack?: string
): TelemetryErrorOrigin {
  if (!stack) return { origin: 'third_party' }

  for (const line of stack.split('\n')) {
    const extensionFolder = /\/extensions\/([^/?#]+)\//.exec(line)?.[1]
    if (extensionFolder) {
      return FIRST_PARTY_EXTENSION_FOLDERS.has(extensionFolder)
        ? { origin: 'first_party' }
        : { origin: 'extension', extension: extensionFolder }
    }

    if (line.includes('/assets/')) return { origin: 'first_party' }
  }

  return { origin: 'third_party' }
}
