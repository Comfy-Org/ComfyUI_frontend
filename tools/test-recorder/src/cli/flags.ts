export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | undefined>
}

/**
 * Parses `--key value` and `--key=value`, leaving everything else positional.
 * Deliberately tiny — the CLI has no need for a parser dependency.
 */
export function parseFlags(args: string[]): ParsedArgs {
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
    if (next !== undefined && !next.startsWith('--')) {
      flags[body] = next
      i++
    } else {
      flags[body] = ''
    }
  }

  return { positional, flags }
}
