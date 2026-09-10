import { spawnSync } from 'node:child_process'
import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'

/**
 * pnpm is pnpm.cmd on Windows, and Node >=18.20 refuses to spawn a .cmd
 * without a shell. POSIX keeps the direct exec so arguments stay unparsed.
 */
export function needsShell(platform: string = process.platform): boolean {
  return platform === 'win32'
}

/**
 * Node does not quote for you when a shell is involved, so an argument
 * carrying a space or a cmd.exe metacharacter — a checkout under
 * `C:\\dev\\R&D\\`, say — would word-split or run as a separate command.
 */
export function quoteForCmd(argument: string): string {
  if (argument === '') return '""'
  if (!/[\s"&|<>^()]/.test(argument)) return argument
  return `"${argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
}

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
): SpawnSyncReturns<Buffer> {
  const shell = options.shell ?? needsShell()
  const finalArgs = shell === true ? args.map(quoteForCmd) : args
  return spawnSync(command, finalArgs, {
    ...options,
    shell
  }) as SpawnSyncReturns<Buffer>
}
