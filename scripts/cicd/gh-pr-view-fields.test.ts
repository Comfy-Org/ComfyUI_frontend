import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const WORKFLOW_DIR = '.github/workflows'

/**
 * JSON fields that `gh pr view --json` no longer accepts. Requesting one makes
 * gh exit non-zero with `Unknown JSON field: "<name>"` before it prints
 * anything, so the call site does not merely read a stale value — it fails.
 *
 * `merged` was dropped upstream and took PR Backport's manual dispatch red on
 * `main` (run 33892240975). The same call in backport-auto-merge.yaml is the
 * reason this is a repo-wide scan rather than a one-line fix: there the error
 * is swallowed by `2>/dev/null || echo false`, so the merge-race reconciliation
 * silently answers "not merged" for every PR and comments a merge failure on
 * backports that did merge.
 */
const REMOVED_FIELDS: Record<string, string> = {
  merged: 'use `state` and compare against "MERGED", or check `mergedAt`'
}

/** Join `\`-continued shell lines so a wrapped `--json` is still seen. */
const joinContinuations = (source: string) => source.replace(/\\\r?\n\s*/g, ' ')

/**
 * Literal `VAR=a,b,c` shell assignments, so a call site that passes its field
 * list indirectly (`--json "$FIELDS"`) is still checked rather than silently
 * skipped — pr-label-backport.yaml does exactly that.
 */
const collectVariables = (source: string) => {
  const variables = new Map<string, string>()
  for (const [, name, value] of source.matchAll(
    /^\s*([A-Za-z_][A-Za-z0-9_]*)=([A-Za-z0-9_,]+)\s*$/gm
  )) {
    variables.set(name, value)
  }
  return variables
}

interface Invocation {
  file: string
  fields: string[]
  line: string
  /** Set when the field list could not be resolved statically. */
  unresolved?: string
}

const collectInvocations = (): Invocation[] => {
  const files = readdirSync(WORKFLOW_DIR).filter((name) =>
    /\.ya?ml$/.test(name)
  )

  return files.flatMap((file) => {
    const source = joinContinuations(
      readFileSync(join(WORKFLOW_DIR, file), 'utf8')
    )
    const variables = collectVariables(source)

    return source
      .split('\n')
      .filter((line) => line.includes('gh pr view') && line.includes('--json'))
      .map((line): Invocation => {
        const base = { file, line: line.trim() }

        // `--json a,b,c` — a literal, comma-separated field list.
        const literal = /--json\s+([A-Za-z0-9_,]+)/.exec(line)
        if (literal) {
          return { ...base, fields: literal[1].split(',').filter(Boolean) }
        }

        // `--json "$FIELDS"` / `--json "${FIELDS}"` — resolve from the file.
        const indirect = /--json\s+"?\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?"?/.exec(
          line
        )
        const resolved = indirect && variables.get(indirect[1])
        if (resolved) {
          return { ...base, fields: resolved.split(',').filter(Boolean) }
        }

        return {
          ...base,
          fields: [],
          unresolved: indirect
            ? `$${indirect[1]} is not a literal assignment in this file`
            : 'field list is not a literal or a resolvable variable'
        }
      })
  })
}

describe('gh pr view --json fields', () => {
  const invocations = collectInvocations()

  // Without this the suite would pass vacuously if the scan ever stopped
  // matching — the failure mode the guard itself is meant to remove.
  it('finds the gh pr view call sites it is meant to guard', () => {
    expect(invocations.length).toBeGreaterThanOrEqual(3)
  })

  // A call site whose fields cannot be read statically is a hole in the scan,
  // not a pass. Keep the list buildable from a literal so this stays checkable.
  it('can resolve every requested field list', () => {
    const unresolved = invocations
      .filter((call) => call.unresolved)
      .map((call) => `${call.file}: ${call.unresolved}\n    ${call.line}`)

    expect(unresolved, unresolved.join('\n  ')).toEqual([])
  })

  it('requests no field that gh has removed', () => {
    const offenders = invocations.flatMap((call) =>
      call.fields
        .filter((field) => field in REMOVED_FIELDS)
        .map(
          (field) =>
            `${call.file}: --json ${field} is not a gh pr view field — ${REMOVED_FIELDS[field]}\n    ${call.line}`
        )
    )

    expect(offenders, offenders.join('\n  ')).toEqual([])
  })
})
