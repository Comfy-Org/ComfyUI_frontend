export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | undefined>
}

/**
 * Named flags take a following value, as does any flag followed by a bare
 * `true` or `false`; other flags never swallow the next argument.
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

    const next = args.at(i + 1)
    if (
      (takesValue.has(body) && next !== undefined && !next.startsWith('--')) ||
      next === 'true' ||
      next === 'false'
    ) {
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

/** A bare `--flag` or `--flag=true` is on; anything else, or absent, is off. */
export function isFlagOn(value: string | undefined): boolean {
  return value === '' || value === 'true'
}
