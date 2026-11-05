export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | undefined>
}

/**
 * Named flags take a following value. Selected boolean flags may also take a
 * separated `true` or `false`; other flags never swallow the next argument.
 */
export function parseFlags(
  args: string[],
  flagsTakingValue: readonly string[] = [],
  booleanFlagsTakingValue: readonly string[] = []
): ParsedArgs {
  const takesValue = new Set(flagsTakingValue)
  const takesBooleanValue = new Set(booleanFlagsTakingValue)
  const positional: string[] = []
  const flags: Record<string, string | undefined> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }

    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      flags[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }

    const next = args.at(i + 1)
    if (
      (takesValue.has(body) && next !== undefined && !next.startsWith('--')) ||
      (takesBooleanValue.has(body) && (next === 'true' || next === 'false'))
    ) {
      flags[body] = next
      i++
    } else {
      flags[body] = takesBooleanValue.has(body) ? 'true' : ''
    }
  }

  return { positional, flags }
}

/** Splits a `--tags a, b,c` value into trimmed, non-empty tag names. */
export function parseTags(value: string | undefined): string[] | undefined {
  const tags = value
    ?.split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
  return tags && tags.length > 0 ? tags : undefined
}

/** Reads a strict boolean flag value and rejects malformed explicit values. */
export function isFlagOn(
  value: string | undefined,
  flagName = 'flag'
): boolean {
  if (value === undefined || value === 'false') return false
  if (value === 'true') return true
  throw new Error(
    `Invalid --${flagName} value "${value}". Use --${flagName}, --${flagName}=true, or --${flagName}=false.`
  )
}
