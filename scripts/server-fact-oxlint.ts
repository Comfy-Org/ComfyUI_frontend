import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { OxlintDiagnostic } from './server-fact-gate-core'
import { oxlintReportSchema } from './server-fact-gate-core'

const repoRoot = path.resolve(import.meta.dirname, '..')
const oxlintEntry = path.join(repoRoot, 'node_modules/oxlint/bin/oxlint')

export const SERVER_FACT_CONFIG = path.join(
  repoRoot,
  'tools/oxlint-plugins/serverFacts.oxlintrc.json'
)

export type LintOutcome =
  | { ok: true; diagnostics: OxlintDiagnostic[] }
  | { ok: false; detail: string }

export function lintServerFacts(
  files: readonly string[],
  { cwd, config }: { cwd: string; config: string }
): LintOutcome {
  if (files.length === 0) return { ok: true, diagnostics: [] }
  const result = spawnSync(
    process.execPath,
    [oxlintEntry, '-c', config, '--format', 'json', ...files],
    { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true }
  )
  const parsed = oxlintReportSchema.safeParse(parseJson(result.stdout))
  return parsed.success
    ? { ok: true, diagnostics: parsed.data.diagnostics }
    : {
        ok: false,
        detail: `oxlint did not produce a report (exit ${result.status}). ${result.error?.message ?? ''}${result.stderr}${result.stdout}`
      }
}

/** Lints file contents at their repo-relative paths without touching the checkout. */
export function lintSnapshot(
  contents: ReadonlyMap<string, string>,
  config: string = SERVER_FACT_CONFIG
): LintOutcome {
  const mirror = mkdtempSync(path.join(tmpdir(), 'server-facts-'))
  try {
    const escaping = [...contents.keys()].find(
      (file) => !isInside(mirror, path.resolve(mirror, file))
    )
    if (escaping !== undefined) {
      return { ok: false, detail: `${escaping} resolves outside the snapshot` }
    }
    for (const [file, text] of contents) {
      const target = path.resolve(mirror, file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, text)
    }
    return lintServerFacts([...contents.keys()], { cwd: mirror, config })
  } finally {
    rmSync(mirror, { recursive: true, force: true })
  }
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return (
    relative !== '' &&
    !path.isAbsolute(relative) &&
    relative.split(path.sep)[0] !== '..'
  )
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
