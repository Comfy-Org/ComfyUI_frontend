import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export function parseFeatureFlagSpecs(
  specs: string[]
): Record<string, unknown> {
  return Object.fromEntries(
    specs.flatMap((spec) => {
      const trimmed = spec.trim()
      if (!trimmed) return []

      const separator = trimmed.indexOf(':')
      const name = (
        separator === -1 ? trimmed : trimmed.slice(0, separator)
      ).trim()
      if (!name) return []
      if (separator === -1) return [[name, true]]

      const rawValue = trimmed.slice(separator + 1).trim()
      try {
        return [[name, JSON.parse(rawValue) as unknown]]
      } catch {
        return [[name, rawValue]]
      }
    })
  )
}

export function buildFfQuery(flags: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(flags)) {
    const encodedValue =
      value === true ? key : `${key}:${JSON.stringify(value) ?? String(value)}`
    params.append('ff', encodedValue)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function extractEnumValues(source: string): string[] {
  const enumBody = source.match(
    /export\s+enum\s+ServerFeatureFlag\s*\{([\s\S]*?)\}/
  )?.[1]
  if (!enumBody) return []

  return [...enumBody.matchAll(/=\s*(['"])(.*?)\1/g)].map((match) => match[2])
}

export function discoverFlagKeys(projectRoot: string): string[] {
  try {
    const source = readFileSync(
      join(projectRoot, 'src', 'composables', 'useFeatureFlags.ts'),
      'utf-8'
    )
    return extractEnumValues(source)
  } catch {
    return []
  }
}

function formatString(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return formatString(value)
  return JSON.stringify(value) ?? 'undefined'
}

export function formatInitialFeatureFlags(
  flags: Record<string, unknown>
): string {
  const entries = Object.entries(flags)
  if (entries.length === 0) return ''

  const lines = entries.map(([key, value]) => {
    const formattedKey = /^[A-Za-z_$][\w$]*$/.test(key)
      ? key
      : formatString(key)
    return `    ${formattedKey}: ${formatValue(value)}`
  })

  return `test.use({
  initialFeatureFlags: {
${lines.join(',\n')}
  }
})`
}
