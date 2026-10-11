export function getPnpmInvocation(
  args: string[],
  pnpmEntry = process.env.npm_execpath
): { command: string; args: string[] } {
  if (!pnpmEntry) {
    throw new Error(
      'Unable to resolve pnpm: run this launcher through a pnpm package script'
    )
  }

  return {
    command: process.execPath,
    args: [pnpmEntry, ...args]
  }
}
