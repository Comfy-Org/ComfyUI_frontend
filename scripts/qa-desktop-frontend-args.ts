import { homedir } from 'node:os'
import { join } from 'node:path'

const FRONTEND_FLAGS = new Set(['--front-end-root', '--front-end-version'])

/** Splits a Desktop `launchArgs` string, honouring double quotes. */
export function splitLaunchArgs(args: string): string[] {
  return (args.match(/"[^"]*"|\S+/g) ?? []).map((token) =>
    token.replace(/^"(.*)"$/, '$1')
  )
}

function joinLaunchArgs(tokens: string[]): string {
  return tokens.map((t) => (/[\s"]/.test(t) ? `"${t}"` : t)).join(' ')
}

/** Drops any frontend override (`--front-end-root`/`--front-end-version`). */
export function withoutFrontendOverride(args: string): string {
  const tokens = splitLaunchArgs(args)
  const kept = tokens.filter((token, i) => {
    const flag = token.split('=')[0]
    if (FRONTEND_FLAGS.has(flag)) return false
    return !(FRONTEND_FLAGS.has(tokens[i - 1]) && !token.startsWith('--'))
  })
  return joinLaunchArgs(kept)
}

/** Points the install at a local frontend build, replacing any override. */
export function withFrontendRoot(args: string, root: string): string {
  return joinLaunchArgs([
    ...splitLaunchArgs(withoutFrontendOverride(args)),
    '--front-end-root',
    root
  ])
}

/** Where Comfy Desktop keeps `installations.json`, packaged or dev build. */
export function installationsPath(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  dev: boolean
): string {
  const home = homedir()
  if (platform === 'linux') {
    const base = env.XDG_DATA_HOME || join(home, '.local', 'share')
    return join(base, 'comfyui-desktop-2', 'installations.json')
  }
  const appDir = dev ? 'comfyui-desktop-2' : 'Comfy Desktop'
  const base =
    platform === 'win32'
      ? env.APPDATA || join(home, 'AppData', 'Roaming')
      : join(home, 'Library', 'Application Support')
  return join(base, appDir, 'installations.json')
}

export interface Installation {
  id: string
  name: string
  sourceId?: string
  launchArgs?: string
}

/** The one local install to change: the named one, or the only one. */
export function pickInstall(
  installs: Installation[],
  wanted?: string
): Installation {
  const local = installs.filter(
    (i) => i.sourceId !== 'cloud' && i.sourceId !== 'remote'
  )
  const match = wanted
    ? local.filter((i) => i.id === wanted || i.name === wanted)
    : local
  if (match.length === 1) return match[0]
  const names = local.map((i) => `  ${i.id}  ${i.name}`).join('\n')
  const problem = match.length === 0 ? 'No matching' : 'More than one'
  throw new Error(
    `${problem} local install; pass --install <id|name>:\n${names}`
  )
}

interface BuildRun {
  databaseId: number
  status: string
  hasArtifact: boolean
}

/** The run whose build to use, or why there is none yet. */
export function pickBuildRun(
  runs: BuildRun[],
  sha: string,
  rerunHint: (runId: number) => string
): number {
  const ready = runs.find((r) => r.hasArtifact)
  if (ready) return ready.databaseId
  const short = sha.slice(0, 7)
  const running = runs.find((r) => r.status !== 'completed')
  if (running) {
    throw new Error(
      `The CI build for ${short} is still running (run ${running.databaseId}). Try again when it finishes.`
    )
  }
  const last = runs.at(0)
  if (!last) throw new Error(`No CI build found for ${short}.`)
  throw new Error(
    `The CI build for ${short} has expired (kept for one day). Rebuild it with: ${rerunHint(last.databaseId)}`
  )
}
