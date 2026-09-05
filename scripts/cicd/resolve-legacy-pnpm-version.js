#!/usr/bin/env node
/**
 * Decide whether `pnpm/action-setup` needs an explicit `version` input for the
 * release tag currently checked out.
 *
 * The weekly release job checks a published tag out into `release/` and points
 * `pnpm/action-setup` at `release/package.json`. The action resolves its target
 * version from `devEngines.packageManager` first, then `packageManager`, and
 * throws `No pnpm version is specified` when a manifest declares neither.
 * Tags published before this repository adopted `packageManager` (for example
 * `v1.27.10`) hit exactly that path.
 *
 * Passing `version` unconditionally is not an option: the action throws
 * `Multiple versions of pnpm specified` when `version` disagrees with a
 * `packageManager` field, which every current tag has. So the fallback has to
 * be conditional, and the condition is "this manifest declares no pnpm
 * version at all".
 *
 * Runs on the runner's preinstalled Node, before pnpm exists, so this file
 * stays dependency-free and is invoked as `node <path>` rather than via tsx.
 */
import { readFileSync } from 'node:fs'

/**
 * The pnpm version a manifest declares, mirroring `pnpm/action-setup`'s own
 * precedence, or `undefined` when it declares none.
 *
 * @param {unknown} manifest parsed `package.json` contents
 * @returns {string | undefined}
 */
export function declaredPnpmVersion(manifest) {
  if (typeof manifest !== 'object' || manifest === null) return undefined

  const devEngines = /** @type {Record<string, any>} */ (manifest).devEngines
  const devEnginesPackageManager = devEngines?.packageManager
  if (
    devEnginesPackageManager?.name === 'pnpm' &&
    typeof devEnginesPackageManager.version === 'string' &&
    devEnginesPackageManager.version !== ''
  ) {
    return devEnginesPackageManager.version
  }

  const packageManager =
    /** @type {Record<string, any>} */ (manifest).packageManager
  if (
    typeof packageManager === 'string' &&
    packageManager.startsWith('pnpm@')
  ) {
    const version = packageManager.slice('pnpm@'.length).split('+')[0]
    if (version !== '') return version
  }

  return undefined
}

/**
 * The value to pass as the action's `version` input: the fallback when the
 * manifest declares no pnpm version, and an empty string otherwise so the
 * action keeps resolving from the manifest.
 *
 * @param {unknown} manifest parsed `package.json` contents
 * @param {string} fallback pnpm version to use for pre-`packageManager` tags
 * @returns {string}
 */
export function resolveVersionInput(manifest, fallback) {
  return declaredPnpmVersion(manifest) === undefined ? fallback : ''
}

/**
 * Read a manifest, tolerating a missing file the same way the action does.
 *
 * @param {string} manifestPath
 * @returns {unknown}
 */
export function readManifest(manifestPath) {
  let contents
  try {
    contents = readFileSync(manifestPath, 'utf8')
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error)?.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
  return JSON.parse(contents)
}

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href

if (isCli) {
  const [manifestPath, fallback] = process.argv.slice(2)
  if (!manifestPath || !fallback) {
    console.error(
      'usage: resolve-legacy-pnpm-version.js <package.json> <fallback-version>'
    )
    process.exit(2)
  }
  process.stdout.write(
    resolveVersionInput(readManifest(manifestPath), fallback)
  )
}
