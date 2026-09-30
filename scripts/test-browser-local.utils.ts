export function quoteForCmd(argument: string): string {
  if (argument === '') return '""'
  if (!/[\s"&|<>^()]/.test(argument)) return argument
  return `"${argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
}

export function getPnpmInvocation(
  args: string[],
  platform: NodeJS.Platform = process.platform
): { command: string; args: string[]; shell: boolean } {
  const shell = platform === 'win32'
  return {
    command: shell ? 'pnpm.cmd' : 'pnpm',
    args: shell ? args.map(quoteForCmd) : args,
    shell
  }
}
