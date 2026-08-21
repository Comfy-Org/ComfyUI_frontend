import { spawnSync } from 'node:child_process'
import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'

/**
 * pnpm is pnpm.cmd on Windows, and Node >=18.20 refuses to spawn a .cmd
 * without a shell. POSIX keeps the direct exec so arguments stay unparsed.
 */
export function needsShell(platform: string = process.platform): boolean {
  return platform === 'win32'
}

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions = {}
): SpawnSyncReturns<Buffer> {
  return spawnSync(command, args, {
    ...options,
    shell: options.shell ?? needsShell()
  }) as SpawnSyncReturns<Buffer>
}
