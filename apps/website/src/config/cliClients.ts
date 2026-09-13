const CLI_CLIENT_IDS = [
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'openclaw',
  'hermes',
  'terminal',
  'ci'
] as const

export type CliClientId = (typeof CLI_CLIENT_IDS)[number]

export function isCliClientId(value: unknown): value is CliClientId {
  return (
    typeof value === 'string' &&
    (CLI_CLIENT_IDS as readonly string[]).includes(value)
  )
}
