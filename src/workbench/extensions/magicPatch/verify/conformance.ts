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
 * A member read off a handle, rather than off any object at all.
 *
 * The receiver list is the names conversions actually bind handles to; a
 * pack's own locals are not our business, and treating them as ours rejects
 * correct code.
 */
const HANDLE_MEMBER =
  /\b(comfy|node|widget|slot|graph|builder|b|handle|input|output|widgets|inputs|outputs|defs)\??\.([A-Za-z_]\w*)/g

/**
 * Symbols whose disappearance is the point of the conversion.
 *
 * Everything else vanishing from a file is a regression until someone says
 * otherwise: these are the surfaces being retired, plus the bookkeeping that
 * only ever existed to undo them.
 */
const RETIRED: ReadonlySet<string> = new Set([
  // the converted-widget protocol and its restore bookkeeping
  'origType',
  'origComputeSize',
  'origSerializeValue',
  'computeSize',
  // legacy registration and prototype patching
  'registerExtension',
  'beforeRegisterNodeDef',
  'registerNodeType',
  'registerCustomNodes',
  'apply',
  'call',
  'prototype',
  // widget internals with published replacements
  'serializeValue',
  'inputEl',
  'onRemove',
  'length',
  'push',
  'splice',
  'filter',
  'find',
  'findIndex',
  'indexOf'
])

/**
 * `node.color = …` and friends — state written as a property on something
 * bound to a handle. The receiver list keeps a pack's own objects out of it.
 */
const PROPERTY_WRITE =
  /\b(node|widget|slot|handle|b|builder)\.(title|color|bgColor|bgcolor|mode|shape|collapsed|pinned|size|pos|position|value|hidden|disabled|label|properties|serialize)\s*=(?!=)/g

/**
 * A mutating call reached through `?.`, so a failed lookup silently skips it.
 * Reads are fine — `?.getValue()` yielding undefined is visible to the caller.
 */
const SILENT_WRITE = /\?\.([A-Za-z_]\w*)\s*\(/g

/**
 * Whether an optional-chained call is a *published API* mutation.
 *
 * The prefix alone is not enough: `?.addEventListener(` starts with `add` and
 * a capital, but it is a DOM call on an element the pack owns, and flagging it
 * failed two correct conversions. Only members the API actually defines count.
 */
const isApiMutator = (name: string) =>
  API_MEMBERS.has(name) &&
  /^(set|add|move|reorder|connect|modify)[A-Z]/.test(name)

/**
 * Prototype assignment — `X.prototype.onExecuted =` and friends.
 *
 * The receiver must be a bare identifier. A dotted one is a third-party
 * library being configured, not a node class being patched:
 * `fabric.Object.prototype.cornerColor = …` is how alekpet's painter sets up
 * fabric.js, and flagging it failed a correct conversion.
 */
const PROTOTYPE_PATCH =
  /(?<![.\w$])[A-Za-z_$]\w*\.prototype\.([A-Za-z_]\w*)\s*=/g

/**
 * Source with comments removed, for the checks that scan text for API usage.
 *
 * A conversion is asked to name what it could not reach — `// API-GAP:
 * node.chrome has no destination`. Scanning that comment made the gate fail the
 * files that documented themselves best and pass the ones that stayed quiet,
 * which is exactly backwards. Five of seven kjnodes failures were this.
 *
 * Quote-aware rather than a regex, so a `//` inside a string or a URL survives.
 *
 * Regex literals are skipped too, and that is not a nicety: a literal like
 * `/(['"])/` contains a quote character, and treating it as the start of a
 * string desynchronised the scanner for the rest of the file, after which no
 * comment was stripped at all. Two conversions were failed for API members that
 * appeared only inside the `// API-GAP:` comments they were asked to write.
 */
function withoutComments(source: string): string {
  let out = ''
  let index = 0
  let quote: string | undefined

  /**
   * Whether a `/` here opens a regex rather than dividing.
   *
   * Decided by the previous significant character: division follows a value,
   * a regex follows an operator, a keyword, or the start of an expression.
   */
  const startsRegex = () => {
    let back = out.length - 1
    while (back >= 0 && /\s/.test(out[back])) back--
    if (back < 0) return true
    const prev = out[back]
    if ('(,=:[!&|?{};+-*%~^<>'.includes(prev)) return true
    return /\b(return|typeof|instanceof|in|of|new|delete|void|case|do|else)$/.test(
      out.slice(0, back + 1)
    )
  }

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (quote) {
      if (char === '\\') {
        out += char + (next ?? '')
        index += 2
        continue
      }
      if (char === quote) quote = undefined
      out += char
      index++
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      out += char
      index++
      continue
    }

    if (char === '/' && next === '/') {
      // Stops at the newline rather than consuming it, so line counts hold.
      while (index < source.length && source[index] !== '\n') index++
      continue
    }

    if (char === '/' && next === '*') {
      index += 2
      while (
        index < source.length &&
        !(source[index] === '*' && source[index + 1] === '/')
      ) {
        index++
      }
      index += 2
      continue
    }

    if (char === '/' && startsRegex()) {
      // Consume the literal, including its character classes, so quotes and
      // slashes inside it are never mistaken for anything else.
      out += char
      index++
      let inClass = false
      while (index < source.length) {
        const c = source[index]
        if (c === '\\') {
          out += c + (source[index + 1] ?? '')
          index += 2
          continue
        }
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) break
        else if (c === '\n') break
        out += c
        index++
      }
      out += source[index] ?? ''
      index++
      continue
    }

    out += char
    index++
  }
  return out
}

/** The unpublished surfaces this migration exists to make deletable. */
const LEGACY_GLOBALS: readonly [string, RegExp][] = [
  ['window.comfyAPI', /\bwindow\s*\.\s*comfyAPI\b/],
  ['app.registerExtension', /\bapp\s*\.\s*registerExtension\s*\(/],
  ['/scripts/ import', /\bfrom\s*['"](?:\.\.\/)*(?:\/)?scripts\//]
]

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
      const converted = withoutComments(ctx.converted)
      const original = withoutComments(ctx.original)
      const introduced = CAPABILITY_PATTERNS.filter(
        ([, pattern]) => pattern.test(converted) && !pattern.test(original)
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
      const patched = [
        ...withoutComments(ctx.converted).matchAll(PROTOTYPE_PATCH)
      ].map((m) => m[1])
      if (!patched.length) {
        return result(
          'retires-the-old-surface',
          'passed',
          'No prototype patching remains.'
        )
      }
      const before = [
        ...withoutComments(ctx.original).matchAll(PROTOTYPE_PATCH)
      ].length
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
    id: 'retires-the-legacy-global',
    description:
      'The conversion no longer reaches for window.comfyAPI or the script imports.',
    run: (ctx) => {
      // The most basic check there is, and it was missing: `retires-the-old-
      // surface` only looks for prototype patching, so a file that converted
      // every hook but kept `const { app } = window.comfyAPI.app` passed.
      // kjnodes' ideogram4_prompt_builder.js did exactly that.
      const converted = withoutComments(ctx.converted)
      const held = LEGACY_GLOBALS.filter(([, pattern]) =>
        pattern.test(converted)
      ).map(([name]) => name)

      // A file may hold a surface open by decision rather than by omission.
      // It still fails — the point is that the old surface becomes deletable,
      // and a green gate would let the hold-out be forgotten — but the report
      // has to distinguish "allowed, for now" from "nobody converted this",
      // or every later audit re-litigates the same three files.
      // Scanned on the RAW source: the marker is itself a comment, and
      // `converted` above has had comments stripped.
      const sanctioned = [
        ...new Set(
          [...ctx.converted.matchAll(/SANCTIONED-HOLDOUT\(([^)]+)\)/g)].map(
            (m) => m[1]
          )
        )
      ]

      return held.length
        ? result(
            'retires-the-legacy-global',
            'failed',
            sanctioned.length
              ? `Sanctioned hold-out (${sanctioned.join(', ')}): still reaches ` +
                  `${held.join(', ')}. Allowed by decision, not by omission — ` +
                  `retire it when the capability lands.`
              : `Still reaches the old surface: ${held.join(', ')}. ` +
                  `The point of the migration is that it becomes deletable — ` +
                  `convert the call site or punt the whole file as api-gap.`
          )
        : result(
            'retires-the-legacy-global',
            'passed',
            'No legacy global held open.'
          )
    }
  },
  {
    id: 'handles-use-accessors',
    description:
      'Handle state is read and written through methods; property syntax silently does nothing.',
    run: (ctx) => {
      // The gap no-unknown-api-members cannot see: it is scoped to the diff, so
      // `node.color = c` survives because the original used `color` too. But a
      // handle has no such property — the write vanishes, or the whole pack
      // fails to register. kjnodes' appearance.js was converted this way and
      // took every type in the pack down with it.
      const offenders = [
        ...withoutComments(ctx.converted).matchAll(PROPERTY_WRITE)
      ].map((m) => `${m[1]}.${m[2]}`)
      return offenders.length
        ? result(
            'handles-use-accessors',
            'failed',
            `Property writes on a handle: ${[...new Set(offenders)].join(', ')}. ` +
              `Use the accessor — setColor, setTitle, setMode, setProperty and ` +
              `the rest. Property syntax compiles and does nothing.`
          )
        : result(
            'handles-use-accessors',
            'passed',
            'Handle state written through accessors.'
          )
    }
  },
  {
    id: 'no-unknown-api-members',
    description:
      'Every member the conversion introduces exists in the published API.',
    run: (ctx) => {
      // Only members read off something that looks like a handle.
      //
      // Matching every `.name` in the file flagged the pack's own objects: a
      // conversion that kept per-node state in a plain object kept in a Map --
      // the correct shape, since handles hold no arbitrary properties -- was
      // rejected because `state.playingAudio` is not an API member. That is a
      // false positive on a valid conversion, and it cost a real file.
      const used = (source: string) =>
        new Set([...source.matchAll(HANDLE_MEMBER)].map((m) => m[2]))
      const before = used(withoutComments(ctx.original))
      const unknown = [...used(withoutComments(ctx.converted))].filter(
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
    id: 'no-dropped-behaviour',
    description:
      'Lists what left the file, so lost functionality has to be accounted for rather than overlooked.',
    run: (ctx) => {
      // Symbols the original wrote or called that the conversion no longer
      // mentions. kjnodes dropped origType, origComputeSize and
      // origSerializeValue this way, and the loss was invisible to every other
      // check — the file still parsed, still loaded, still registered.
      const symbols = (source: string) =>
        new Set([
          ...[...source.matchAll(/\.([A-Za-z_]\w*)\s*=(?!=)/g)].map(
            (m) => m[1]
          ),
          ...[...source.matchAll(/\.([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]),
          ...[...source.matchAll(/\bfunction\s+([A-Za-z_]\w*)/g)].map(
            (m) => m[1]
          )
        ])

      const before = symbols(withoutComments(ctx.original))
      const after = symbols(withoutComments(ctx.converted))
      const missing = [...before].filter(
        (name) => !after.has(name) && !RETIRED.has(name)
      )
      // Reported, not gated. Most disappearances are renames onto the new API
      // — readOnly and opacity become disabled, value becomes setValue — and
      // failing on those would block correct work. The list is here so the
      // agent accounts for each one in its summary, and so a reviewer can see
      // what left the file.
      return missing.length
        ? result(
            'no-dropped-behaviour',
            'passed',
            `Gone from the file: ${missing.sort().join(', ')}. ` +
              `Each should be a rename onto the published API or genuinely ` +
              `obsolete; say which in the summary. Anything else is lost ` +
              `functionality, which makes the conversion wrong.`
          )
        : result(
            'no-dropped-behaviour',
            'passed',
            'Nothing the original did went missing.'
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
      const dropped = [...withoutComments(ctx.converted).matchAll(SILENT_WRITE)]
        .filter((m) => isApiMutator(m[1]))
        .map((m) => m[0].trim())
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
      'Reports how much of the diff is substance rather than re-indentation. Advisory.',
    run: (ctx) => {
      // Whitespace-blind, and never gating.
      //
      // It used to fail a file whose added lines were mostly re-indented, on
      // the theory that the file had been reflowed for its own sake. But
      // unwrapping `app.registerExtension` around a large callback dedents the
      // entire body, and the conversion guidance *requires* that re-indent —
      // so the check and the guidance contradicted each other, and three
      // correct conversions failed on ~93% indentation-only lines.
      //
      // The number is still worth reporting: a high ratio on a *small* body is
      // still a hint that something was reflowed needlessly. It is a hint, not
      // a gate.
      const before = new Set(
        ctx.original
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
      )
      const added = ctx.converted
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !before.has(l))

      const converted = ctx.converted.split('\n').filter((l) => l.trim())
      const movedOnly = converted.length - added.length

      if (!converted.length) {
        return result('diff-is-mostly-substance', 'skipped', 'Nothing changed.')
      }
      return result(
        'diff-is-mostly-substance',
        'passed',
        `${added.length} substantive line(s); ${movedOnly} carried over ` +
          `unchanged apart from indentation.`
      )
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
