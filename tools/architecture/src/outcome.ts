import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

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
  attempt(`read ${filename}`, () => readFileSync(join(root, filename), 'utf8'))

const writeText = (root: string, filename: string, text: string) =>
  attempt(`write ${filename}`, () => writeFileSync(join(root, filename), text))

export const listDirectory = (
  root: string,
  directory: string,
  recursive: boolean
) =>
  attempt(`list ${directory}`, () =>
    readdirSync(join(root, directory), { recursive }).map((entry) =>
      String(entry).replaceAll('\\', '/')
    )
  )

export function readJson(root: string, filename: string): Outcome<unknown> {
  const text = readText(root, filename)
  if (!text.ok) return text
  return attempt(`parse ${filename} as JSON`, () => JSON.parse(text.value))
}

function runOxfmt(root: string, filename: string): Outcome<void> {
  const action = `format ${filename} with oxfmt`
  const oxfmtPackage = attempt(`resolve oxfmt`, () =>
    createRequire(import.meta.url).resolve('oxfmt/package.json')
  )
  if (!oxfmtPackage.ok) return oxfmtPackage
  const result = spawnSync(
    process.execPath,
    [join(dirname(oxfmtPackage.value), 'bin/oxfmt'), '--write', filename],
    { cwd: root, encoding: 'utf8' }
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
  return { ok: true, value: undefined }
}

/** Writes a file, then formats it with the repository's oxfmt config. */
export function writeFormatted(
  root: string,
  filename: string,
  text: string
): Outcome<void> {
  const written = writeText(root, filename, text)
  if (!written.ok) return written
  return runOxfmt(root, filename)
}
