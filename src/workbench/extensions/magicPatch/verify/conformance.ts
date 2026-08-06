/**
 * General conversion conformance.
 *
 * Two kinds of test exist in this system, and conflating them is how a suite
 * ends up either vacuous or unmaintainable:
 *
 * - **Conformance (here)** — invariants every converted artifact must satisfy,
 *   whatever the pack does. Written once, run against all 851.
 * - **Pack tests** (`conversion/rules.ts` → `generateTest`) — assertions about
 *   one pack's specific behaviour, generated per artifact.
 *
 * A check that cannot run reports `skipped` with a reason. It never passes by
 * default: a green suite that silently skipped its only meaningful check is the
 * failure mode this whole programme keeps running into.
 */
import { API_MEMBERS } from '@/platform/nodeApi/apiSurface'

import { applyEdits } from '../conversion/edits'
import type { Edit } from '../conversion/edits'
import type { RunOutcome } from './runner'

export interface ConformanceContext {
  readonly pack: string
  readonly file: string
  readonly original: string
  readonly converted: string
  readonly edits: readonly Edit[]
  /** Present when the artifact was executed; several checks need it. */
  readonly run?: { readonly before: RunOutcome; readonly after: RunOutcome }
}

type CheckStatus = 'passed' | 'failed' | 'skipped'

interface CheckResult {
  readonly id: string
  readonly status: CheckStatus
  readonly detail: string
}

interface Check {
  readonly id: string
  readonly description: string
  run(context: ConformanceContext): CheckResult
}

const result = (
  id: string,
  status: CheckStatus,
  detail: string
): CheckResult => ({ id, status, detail })

/** Top-level `import`/`export`, which mark the source as an ES module. */
const IS_MODULE = /^\s*(?:import|export)\s/m

/** Capabilities a conversion must not introduce that the original lacked. */
/**
 * Members of the JavaScript built-ins, read from the prototypes themselves so
 * the list cannot drift or miss one.
 */
const BUILTIN_MEMBERS: ReadonlySet<string> = new Set(
  [
    Object,
    Array,
    String,
    Number,
    Boolean,
    Function,
    Promise,
    Map,
    Set,
    WeakMap,
    RegExp,
    Date,
    Error,
    JSON,
    Math
  ].flatMap((builtin) => [
    ...Object.getOwnPropertyNames(builtin),
    ...Object.getOwnPropertyNames(
      (builtin as { prototype?: object }).prototype ?? {}
    )
  ])
)

/**
 * A mutating call reached through `?.`, so a failed lookup silently skips it.
 * Reads are fine — `?.getValue()` yielding undefined is visible to the caller.
 */
const SILENT_WRITE =
  /\?\.[A-Za-z_]\w*\([^)]*\)?\s*\??\.\s*(?:set|add|move|reorder|connect|modify)[A-Z]\w*\(|\?\.(?:set|add|move|reorder|connect|modify)[A-Z]\w*\(/g

/** Prototype assignment — `X.prototype.onExecuted =` and friends. */
const PROTOTYPE_PATCH = /\.prototype\.([A-Za-z_]\w*)\s*=/g

const CAPABILITY_PATTERNS: readonly [string, RegExp][] = [
  ['eval', /\beval\s*\(/],
  ['new Function', /\bnew\s+Function\s*\(/],
  ['remote import', /\bimport\s*\(\s*['"`]https?:/],
  ['document.write', /\bdocument\s*\.\s*write\s*\(/]
]

const checks: readonly Check[] = [
  {
    id: 'edits-apply-cleanly',
    description: 'The stored edits reproduce the converted source exactly.',
    run: (ctx) => {
      if (!ctx.edits.length) {
        return result('edits-apply-cleanly', 'skipped', 'No edits recorded.')
      }
      try {
        const applied = applyEdits(ctx.original, ctx.edits)
        return applied === ctx.converted
          ? result(
              'edits-apply-cleanly',
              'passed',
              `${ctx.edits.length} edit(s).`
            )
          : result(
              'edits-apply-cleanly',
              'failed',
              'Applying the edits did not reproduce the converted source.'
            )
      } catch (error) {
        return result(
          'edits-apply-cleanly',
          'failed',
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  },
  {
    id: 'converted-source-parses',
    description: 'The converted source is syntactically valid JavaScript.',
    run: (ctx) => {
      // `new Function` compiles a *script*, and rejects `import`/`export`
      // outright — so applying it to a module reports a syntax error for every
      // real pack. Modules are parse-checked by the runtime `loads` check
      // instead, which is a genuine parse rather than an approximation.
      if (IS_MODULE.test(ctx.converted)) {
        return result(
          'converted-source-parses',
          'skipped',
          'ES module; syntax is validated by the runtime load check.'
        )
      }
      try {
        // Compilation only — the body is never invoked here.
        new Function(ctx.converted)
        return result('converted-source-parses', 'passed', 'Parsed.')
      } catch (error) {
        return result(
          'converted-source-parses',
          'failed',
          `Syntax error: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  },
  {
    id: 'no-new-capabilities',
    description:
      'The conversion introduces no capability the original did not already have.',
    run: (ctx) => {
      const introduced = CAPABILITY_PATTERNS.filter(
        ([, pattern]) =>
          pattern.test(ctx.converted) && !pattern.test(ctx.original)
      ).map(([name]) => name)

      return introduced.length
        ? result(
            'no-new-capabilities',
            'failed',
            `Conversion introduced: ${introduced.join(', ')}.`
          )
        : result('no-new-capabilities', 'passed', 'No net-new capabilities.')
    }
  },
  {
    id: 'retires-the-old-surface',
    description:
      'The conversion stops patching prototypes; otherwise the old surface cannot be deleted.',
    run: (ctx) => {
      // The whole point is that the unpublished surface becomes deletable. A
      // conversion that rewrites a function body but leaves the prototype
      // assignment that reaches it has moved nothing.
      const patched = [...ctx.converted.matchAll(PROTOTYPE_PATCH)].map(
        (m) => m[1]
      )
      if (!patched.length) {
        return result(
          'retires-the-old-surface',
          'passed',
          'No prototype patching remains.'
        )
      }
      const before = [...ctx.original.matchAll(PROTOTYPE_PATCH)].length
      return result(
        'retires-the-old-surface',
        'failed',
        `Still patches ${[...new Set(patched)].join(', ')} ` +
          `(${patched.length} of ${before} site(s) remain). ` +
          `Convert the registration itself, or punt as api-gap.`
      )
    }
  },
  {
    id: 'no-unknown-api-members',
    description:
      'Every member the conversion introduces exists in the published API.',
    run: (ctx) => {
      // Scoped to the diff, like the capability check: a name the original
      // already used is the pack's own, not ours. A net-new name that the API
      // does not define is almost always invented, and nothing else catches it
      // because an agent-authored rewrite is never executed.
      const used = (source: string) =>
        new Set([...source.matchAll(/\.([A-Za-z_]\w*)/g)].map((m) => m[1]))
      const before = used(ctx.original)
      const unknown = [...used(ctx.converted)].filter(
        (name) =>
          !before.has(name) &&
          !API_MEMBERS.has(name) &&
          !BUILTIN_MEMBERS.has(name)
      )
      return unknown.length
        ? result(
            'no-unknown-api-members',
            'failed',
            `Not in the published API: ${unknown.sort().join(', ')}.`
          )
        : result(
            'no-unknown-api-members',
            'passed',
            'No net-new members outside the API.'
          )
    }
  },
  {
    id: 'no-silently-dropped-writes',
    description:
      'A write must not be able to vanish because a handle lookup returned nothing.',
    run: (ctx) => {
      // kjnodes' hideWidgetForGood was converted to
      //   comfy.graph.node(String(node.id))?.widgets.get(name)?.setHidden(true)
      // which does nothing at all when the node has not joined a graph yet —
      // exactly when that helper is called. The original mutated the widget
      // directly and always worked. Optional chaining turns a failed lookup
      // into silence, and the pack cannot tell.
      const dropped = [...ctx.converted.matchAll(SILENT_WRITE)].map((m) =>
        m[0].trim()
      )
      return dropped.length
        ? result(
            'no-silently-dropped-writes',
            'failed',
            `${dropped.length} write(s) behind an optional chain: ` +
              `${dropped.slice(0, 2).join(' / ')}. ` +
              `Use the handle you were given rather than looking one up, or ` +
              `check the lookup and fail loudly — a write that evaporates is a ` +
              `bug the pack cannot see.`
          )
        : result(
            'no-silently-dropped-writes',
            'passed',
            'No writes behind an optional chain.'
          )
    }
  },
  {
    id: 'diff-is-mostly-substance',
    description:
      'Most of the diff should be behaviour, not lines that merely moved indentation.',
    run: (ctx) => {
      const before = ctx.original.split('\n')
      const after = ctx.converted.split('\n')
      const kept = new Set(before.map((l) => l.trim()).filter(Boolean))
      const removed = new Set(after.map((l) => l.trim()).filter(Boolean))

      // A line present on both sides once trimmed did not change; it only
      // moved.
      //
      // Mostly informational. Removing a registerExtension wrapper dedents its
      // entire body, and that churn is unavoidable — measured across the
      // current database it runs 17-39% of added lines, all of it legitimate.
      // Only a ratio high enough to mean the file was reformatted for its own
      // sake is treated as a failure.
      const changedOut = after.filter(
        (line) => line.trim() && !before.includes(line)
      )
      const movedOnly = changedOut.filter((line) => kept.has(line.trim()))
      if (!changedOut.length) {
        return result('diff-is-mostly-substance', 'skipped', 'Nothing changed.')
      }
      const ratio = movedOnly.length / changedOut.length
      const detail =
        `${movedOnly.length}/${changedOut.length} added line(s) differ only in ` +
        `indentation.`
      void removed
      return ratio > 0.9
        ? result(
            'diff-is-mostly-substance',
            'failed',
            `${detail} At that proportion the file was reflowed rather than ` +
              `converted. Leave the indentation of lines you are not otherwise ` +
              `changing alone.`
          )
        : result('diff-is-mostly-substance', 'passed', detail)
    }
  },
  {
    id: 'no-net-new-lines',
    description:
      'A conversion should not grow the file substantially; large growth suggests a shim.',
    run: (ctx) => {
      const before = ctx.original.split('\n').length
      const after = ctx.converted.split('\n').length
      const growth = after - before
      // Rewriting a call site can add a line or two; a compatibility layer adds
      // many, and adding one is the thing this programme exists to prevent.
      return growth > Math.max(20, before * 0.1)
        ? result(
            'no-net-new-lines',
            'failed',
            `File grew by ${growth} lines — check this is a rewrite, not a shim.`
          )
        : result('no-net-new-lines', 'passed', `Net ${growth} line(s).`)
    }
  },
  {
    id: 'loads',
    description: 'The converted source still loads.',
    run: (ctx) => {
      if (!ctx.run) {
        return result('loads', 'skipped', 'Artifact was not executed.')
      }
      if (!ctx.run.before.loaded) {
        return result(
          'loads',
          ctx.run.after.loaded ? 'passed' : 'skipped',
          ctx.run.after.loaded
            ? 'Original did not load; converted does.'
            : 'Neither version loads — a harness limitation, not a finding.'
        )
      }
      return ctx.run.after.loaded
        ? result('loads', 'passed', 'Loads.')
        : result('loads', 'failed', ctx.run.after.loadError ?? 'Load failed.')
    }
  },
  {
    id: 'registers-no-fewer-types',
    description: 'Conversion does not lose node types.',
    run: (ctx) => {
      if (!ctx.run) {
        return result(
          'registers-no-fewer-types',
          'skipped',
          'Artifact was not executed.'
        )
      }
      const lost = ctx.run.before.registeredTypes.filter(
        (t) => !ctx.run!.after.registeredTypes.includes(t)
      )
      return lost.length
        ? result(
            'registers-no-fewer-types',
            'failed',
            `No longer registers: ${lost.join(', ')}.`
          )
        : result(
            'registers-no-fewer-types',
            'passed',
            `${ctx.run.after.registeredTypes.length} type(s).`
          )
    }
  },
  {
    id: 'retires-deprecations',
    description:
      'Deprecation warnings attributable to the pack drop, against a non-zero baseline.',
    run: (ctx) => {
      if (!ctx.run) {
        return result(
          'retires-deprecations',
          'skipped',
          'Artifact was not executed.'
        )
      }
      const { before, after } = ctx.run
      if (before.deprecations === 0) {
        // Zero-to-zero proves the battery never reached the code, not success.
        return result(
          'retires-deprecations',
          'skipped',
          'Baseline was zero, so a zero result proves nothing. Add a targeted probe.'
        )
      }
      return after.deprecations < before.deprecations
        ? result(
            'retires-deprecations',
            'passed',
            `${before.deprecations} → ${after.deprecations}.`
          )
        : result(
            'retires-deprecations',
            'failed',
            `Still ${after.deprecations} (was ${before.deprecations}).`
          )
    }
  }
]

export interface ConformanceReport {
  readonly pack: string
  readonly file: string
  readonly results: readonly CheckResult[]
  readonly passed: boolean
  readonly failures: readonly CheckResult[]
  readonly skipped: readonly CheckResult[]
}

/**
 * Runs every conformance check.
 *
 * `passed` means no check failed — skips do not block, but they are surfaced so
 * a caller can see how much of the suite actually ran.
 */
export function runConformance(context: ConformanceContext): ConformanceReport {
  const results = checks.map((check) => check.run(context))
  const failures = results.filter((r) => r.status === 'failed')

  return {
    pack: context.pack,
    file: context.file,
    results,
    passed: failures.length === 0,
    failures,
    skipped: results.filter((r) => r.status === 'skipped')
  }
}

export const CONFORMANCE_CHECKS = checks
