export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | undefined>
}

/**
 * Only the named flags take a value, so a positional argument following a
 * flag that takes none is never swallowed.
 */
export function parseFlags(
  args: string[],
  flagsTakingValue: readonly string[] = []
): ParsedArgs {
  const takesValue = new Set(flagsTakingValue)
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

    const next = args[i + 1]
    if (takesValue.has(body) && next !== undefined && !next.startsWith('--')) {
      flags[body] = next
      i++
    } else {
      flags[body] = ''
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
