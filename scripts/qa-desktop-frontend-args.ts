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
