import { spawnSync } from 'node:child_process'
import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process'

/**
 * On Windows, pnpm resolves to pnpm.cmd, and since Node 18.20 / 20.12
 * spawning a .cmd without a shell throws EINVAL. Node quotes the argument
 * vector for us when shell is enabled, so routing through the shell there is
 * both necessary and safe. POSIX keeps the direct exec — no shell parsing of
 * arguments that may contain spaces.
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
