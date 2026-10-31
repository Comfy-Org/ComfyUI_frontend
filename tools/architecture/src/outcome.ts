import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

export type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] }

const describeCause = (cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause)

/** Runs an untrusted operation and returns its failure as an error message. */
export function attempt<T>(action: string, run: () => T): Outcome<T> {
  try {
    return { ok: true, value: run() }
  } catch (cause) {
    return {
      ok: false,
      errors: [`Could not ${action}: ${describeCause(cause)}`]
    }
  }
}

export const readText = (root: string, filename: string) =>
  attempt(`read ${filename}`, () =>
    readFileSync(resolve(root, filename), 'utf8')
  )

export const writeText = (root: string, filename: string, text: string) =>
  attempt(`write ${filename}`, () =>
    writeFileSync(resolve(root, filename), text)
  )

export const listDirectory = (
  root: string,
  directory: string,
  recursive: boolean
) =>
  attempt(`list ${directory}`, () =>
    readdirSync(resolve(root, directory), { recursive }).map((entry) =>
      String(entry).replaceAll('\\', '/')
    )
  )

export function readJson(root: string, filename: string): Outcome<unknown> {
  const text = readText(root, filename)
  if (!text.ok) return text
  return attempt(`parse ${filename} as JSON`, () => JSON.parse(text.value))
}

const require = createRequire(import.meta.url)

function runPackageBinary(
  root: string,
  action: string,
  resolvePackageJson: () => string,
  binary: string,
  args: string[]
): Outcome<string> {
  const packageJson = attempt(`resolve ${binary}`, resolvePackageJson)
  if (!packageJson.ok) return packageJson
  const result = spawnSync(
    process.execPath,
    [join(dirname(packageJson.value), 'bin', binary), ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  )
  if (result.error)
    return {
      ok: false,
      errors: [`Could not ${action}: ${describeCause(result.error)}`]
    }
  if (result.status !== 0)
    return {
      ok: false,
      errors: [`Could not ${action}: ${result.stderr || result.stdout}`]
    }
  return { ok: true, value: result.stdout }
}

/** Reads Fallow's module graph as Graphviz DOT text. */
export function readImportGraph(root: string): Outcome<string> {
  const directory = attempt('create a temporary directory', () =>
    mkdtempSync(join(tmpdir(), 'architecture-graph-'))
  )
  if (!directory.ok) return directory
  const out = join(directory.value, 'graph.dot')
  try {
    const ran = runPackageBinary(
      root,
      'read the Fallow import graph',
      () => require.resolve('fallow/package.json'),
      'fallow',
      ['viz', '--viz-format', 'dot', '--no-open', '--quiet', '--out', out]
    )
    return ran.ok ? readText(root, out) : ran
  } finally {
    rmSync(directory.value, { recursive: true, force: true })
  }
}

/** Writes a file, then formats it with the repository's oxfmt config. */
export function writeFormatted(
  root: string,
  filename: string,
  text: string
): Outcome<void> {
  const written = writeText(root, filename, text)
  if (!written.ok) return written
  const formatted = runPackageBinary(
    root,
    `format ${filename} with oxfmt`,
    () => require.resolve('oxfmt/package.json'),
    'oxfmt',
    ['--write', filename]
  )
  return formatted.ok ? { ok: true, value: undefined } : formatted
}
