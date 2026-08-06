/**
 * Batch conversion driver for Magic Patch.
 *
 * Runs one Claude agent per **pack**. Each agent reads the pack's files,
 * converts the ones the mechanical rules escalated, writes a test, runs the
 * conformance harness, and marks each file complete only when its checks pass.
 *
 *   npm i -D @anthropic-ai/claude-agent-sdk
 *   node <tsx> scripts/magic-patch/convert.mjs --corpus ~/comfy/nodes-compat-study/corpus/registry_js --limit 1
 *
 * Auth
 * ----
 * Uses the Claude Agent SDK, which runs through the installed Claude Code and
 * its credentials — **no API key**. Claude Code's OAuth token is not authorised
 * for direct `/v1/messages` calls (it returns 429 while the CLI works fine), so
 * the Anthropic API SDK is not an option here.
 *
 * Why the pack, not the file
 * --------------------------
 * File granularity is the obvious choice — files are what the rules detect and
 * what the harness verifies — but it is wrong for real packs, measurably:
 *
 * - **52 of rgthree's 74 JS files import a sibling.** Converting one in
 *   isolation edits one side of a contract while blind to the other.
 * - **ComfyUI-Easy-Use defines `hideWidget` in three separate files.** Per-file
 *   agents convert it three times, with no guarantee they agree.
 *
 * So the agent's context is the pack and its unit of work is the file: it reads
 * any file, and submits conversions one at a time so attribution and
 * verification stay per-file.
 *
 * Other design notes
 * ------------------
 * - **The agent cannot mark work complete without running the checks.**
 *   `mark_complete` refuses unless `run_checks` passed for the current draft.
 * - **Punting is a first-class, categorised outcome.** An accurate
 *   "fundamentally incompatible with Nodes 2.0" beats a forced conversion, and
 *   the category routes the work item to the right place.
 * - Detection and verification are imported from the TypeScript catalog rather
 *   than reimplemented, so CI, the browser and this driver cannot disagree.
 * - Work is resumable: packs already in the ledger are skipped.
 */
import {
  createSdkMcpServer,
  query,
  tool as rawTool
} from '@anthropic-ai/claude-agent-sdk'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  rmSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { spawn } from 'node:child_process'
import { basename, dirname, join, relative } from 'node:path'
import { z } from 'zod'

import { convert } from '../../src/workbench/extensions/magicPatch/conversion/convert'
import { detectLegacyUsage } from '../../src/workbench/extensions/magicPatch/conversion/legacySurface'
import { RULES, RULE_CATALOG_VERSION } from '../../src/workbench/extensions/magicPatch/conversion/rules'
import { toUnifiedDiff } from '../../src/workbench/extensions/magicPatch/conversion/edits'
import { runConformance } from '../../src/workbench/extensions/magicPatch/verify/conformance'
import { verifyPack } from './harness/verifyPack.mjs'

const REPO = new URL('../..', import.meta.url).pathname
const SKILL_DIR = join(REPO, '.claude/skills/converting-custom-nodes')
const API_MAJOR = 1
const DEFAULT_MODEL = 'claude-opus-5'
const MAX_BYTES = 2_000_000
const MAX_READ_CHARS = 400_000

/** Which skill reference explains each rule — loaded only when one matched. */
/** Loaded for every pack, whatever the rules matched. */
const ALWAYS_REFERENCES = ['nodegraph-101.md']

/** Which skill reference explains each rule — loaded only when one matched. */
const RULE_REFERENCES = {
  'type-write-noop': 'node-definitions.md',
  'output-links-mutation': 'node-definitions.md',
  'input-link-write': 'node-definitions.md',
  'widgets-array-mutation': 'widgets.md',
  'converted-widget-protocol': 'widgets.md'
}

/** `export function name(` / `export const name = (` and their signatures. */
const EXPORT_SIGNATURE = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g

/**
 * Callers in the same pack left behind by a changed export signature.
 *
 * Crystools' conversion changed `displayContext(nodeType, app, index, serialize)`
 * to `displayContext(nodeName, index, serialize)` while three call sites in two
 * sibling files kept passing the old arguments. Every per-file check passed;
 * the pack was broken. Only a pack-level view catches this.
 */
function strandedCallers(work, state, fullPath, name) {
  const original = readFileSync(fullPath, 'utf8')
  const draft = state.drafts.get(name)

  const signatures = (source) =>
    new Map(
      [...source.matchAll(EXPORT_SIGNATURE)].map(([, id, params]) => [
        id,
        params.replace(/\s+/g, '')
      ])
    )
  const before = signatures(original)
  const after = signatures(draft)
  const changed = [...before]
    .filter(([id, params]) => after.has(id) && after.get(id) !== params)
    .map(([id]) => id)
  if (!changed.length) return []

  const stranded = []
  for (const path of work.readable) {
    if (path === fullPath) continue
    const caller = relative(work.root, path)
    if (state.drafts.has(caller)) continue
    let source
    try {
      source = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    for (const id of changed) {
      if (new RegExp(`\\b${id}\\s*\\(`).test(source)) {
        stranded.push({ export: id, caller })
      }
    }
  }
  return stranded
}

/** Why a file was abandoned. Each category routes somewhere different. */
const PUNT_REASONS = {
  incompatible:
    'No equivalent under Nodes 2.0 / ECS — needs an author rewrite, not a conversion.',
  'api-gap':
    'The published API has no destination for a construct this file needs. A core gap to file.',
  ambiguous:
    'Intent unrecoverable — most often live-node versus serialized workflow data.',
  'too-large':
    'Beyond a mechanical conversion; needs restructuring only the author can validate.'
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function jsFiles(dir, depth = 0) {
  if (depth > 6) return []
  let names = []
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    const path = join(dir, name)
    try {
      return statSync(path).isDirectory()
        ? jsFiles(path, depth + 1)
        : path.endsWith('.js')
          ? [path]
          : []
    } catch {
      return []
    }
  })
}

/** Groups escalated files by pack, carrying every sibling as readable context. */
function detect(corpus) {
  const guidance = new Map(RULES.map((rule) => [rule.id, rule.guidance]))
  const packs = []

  for (const pack of readdirSync(corpus)) {
    const root = join(corpus, pack)
    const readable = []
    const files = []

    for (const path of jsFiles(root)) {
      let source
      try {
        source = readFileSync(path, 'utf8')
      } catch {
        continue
      }
      if (source.length > MAX_BYTES) continue
      readable.push(path)

      const result = convert(source)
      const legacy = detectLegacyUsage(source)

      // Any file still on the old surface is in scope, not just the ones
      // matching a rule. The catalog describes five patterns; gating on it
      // left most of every pack unexamined — 115 of comfy-mtb's 119 files, 66
      // of rgthree's 74 — and unexamined is not the same as clean.
      if (!result.escalated.length && !legacy.usesLegacyApi) continue

      files.push({
        path,
        name: relative(root, path),
        surfaces: legacy.surfaces,
        // An escalation means this file is incompatible with ECS, which is
        // what makes its pack worth selecting at all.
        incompatible: result.escalated.length > 0,
        findings: result.escalated.map((m) => ({
          rule: m.rule,
          line: m.line,
          text: m.text,
          escalation: m.escalation ?? '',
          guidance: guidance.get(m.rule) ?? ''
        }))
      })
    }

    // Two different questions, deliberately.
    //
    // *Selection* is per pack and asks whether anything in it is incompatible
    // with ECS — that is what makes the pack worth the cost of converting.
    // *Scope* is per file and asks whether it still touches the old API: once
    // a pack is selected it is converted whole, because a pack half on the new
    // surface is a pack that still pins the old one in place.
    const incompatible = files.filter((f) => f.incompatible)
    if (incompatible.length) packs.push({ pack, root, files, readable })
  }
  return packs
}

// ---------------------------------------------------------------------------
// Prompting
// ---------------------------------------------------------------------------

const read = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '')

function systemPrompt() {
  return `You convert third-party ComfyUI custom-node JavaScript onto a published API.

Two invariants govern every conversion:

1. The wire format must be byte-identical. \`graphToPrompt\` output and the
   serialized workflow must not change. Disconnect-and-reconnect allocates new
   link ids and breaks this — use moveLinksTo when re-homing links.
2. Behaviour must be equivalent, except where the old code threw. Your test
   states an equivalence claim (passes on both sources) and a fix claim (fails
   on the original, passes on the converted source).

Refusing is a good outcome when you are not sure. A wrong rewrite of working
code is invisible until a user hits it; an escalation costs one round trip.

${read(join(SKILL_DIR, 'SKILL.md'))}

--- Published API specification ---

${read(join(REPO, 'docs/node_api_WIP.md'))}`
}

/** Deep-dive references for the patterns this pack actually hit. */
function references(work) {
  const matched = new Set(
    work.files.flatMap((f) => f.findings.map((x) => x.rule))
  )
  const names = [
    ...new Set([
      // The primer goes first and always: without the definition/class/instance
      // model, an agent reconstructs it from pack source and often gets it
      // subtly wrong.
      ...ALWAYS_REFERENCES,
      ...[...matched].map((rule) => RULE_REFERENCES[rule]).filter(Boolean)
    ])
  ]
  const sections = names
    .map((name) => {
      const body = read(join(SKILL_DIR, 'references', name))
      return body ? `--- ${name} ---\n\n${body}` : ''
    })
    .filter(Boolean)
  return sections.length
    ? 'Pattern references — measured breakdowns, real before/after, and the way ' +
        'each conversion silently goes wrong:\n\n' +
        sections.join('\n\n')
    : ''
}

/**
 * Everything the driver already knows, put where the agent starts.
 *
 * Tracing showed 55 of a conversion's first 61 tool calls were reconnaissance:
 * every file read, findings re-fetched per file — each one a full model round
 * trip returning data detection had already computed. Inlining source and
 * findings removes the survey; the cap keeps a pathological pack from turning
 * the prompt into the corpus.
 */
const MAX_INLINE_FILE = 24_000
const MAX_INLINE_TOTAL = 240_000

function inlineSources(work) {
  let budget = MAX_INLINE_TOTAL
  const sections = []
  for (const file of work.files) {
    let source
    try {
      source = readFileSync(file.path, 'utf8')
    } catch {
      continue
    }
    if (source.length > MAX_INLINE_FILE || source.length > budget) {
      sections.push(
        `--- ${file.name} (${source.length} bytes — too large to inline; read_file it) ---`
      )
      continue
    }
    budget -= source.length
    sections.push(`--- ${file.name} ---\n\`\`\`js\n${source}\n\`\`\``)
  }
  const siblings = work.readable
    .map((path) => relative(work.root, path))
    .filter((name) => !work.files.some((f) => f.name === name))
  return (
    sections.join('\n\n') +
    (siblings.length
      ? `\n\nOther JS files in the pack (read_file on demand):\n${siblings
          .map((name) => `  ${name}`)
          .join('\n')}`
      : '')
  )
}

/** What each delegated converter is told. The lead supplies the file list. */
function converterPrompt(work) {
  return `You convert files from the ComfyUI custom-node pack "${work.pack}" off
the deprecated APIs and onto the published node API.

Your briefing names which files are yours. Convert exactly those and no others
— another agent owns the rest, and two agents writing the same file will fight.

The briefing carries what the lead already worked out: what the pack does, how
its files relate, the conversion pattern it established, and the traps in your
files. Trust it and start from it. Read what you need to confirm, but do not
re-derive the pack from scratch.

${references(work)}

For each file you own:
1. read_file it, and read_file any sibling whose contract it touches. You may
   read anything in the pack; you may only write your own files.
2. write_conversion, then run_checks, and fix whatever fails.
3. mark_complete, or give_up with the category that fits. Batch punts into one
   give_up call.
4. suggest_skill_note for anything you had to work out that the skill does not
   already say.

Do not add a compatibility shim. Keep the diff small: change the registration
and leave everything else where it is — no hoisting, renaming, reordering or
restyling the conversion does not require.

Handle state is read and written through methods, never properties:
setTitle, setColor, setBgColor, setMode, setCollapsed, setProperty,
setSize([w, h]) on nodes; getValue/setValue, isHidden/setHidden, setOption on
widgets. Property syntax compiles and silently does nothing.

A file counts as done ONLY when you have called mark_complete or give_up for
it. Nothing else records anything — not finishing, not saying so in your reply.
A draft you wrote and checked but did not mark_complete is thrown away, and the
lead will see the file as untouched.

So before you finish: every file in your briefing has had mark_complete or
give_up called on it. Then reply with one line per file saying which it was.`
}

function buildPrompt(work) {
  const perFile = work.files
    .map(
      (f) =>
        `${f.name}\n` +
        f.findings
          .map(
            (x) =>
              `  line ${x.line} [${x.rule}]: ${x.text}\n    ${x.escalation}`
          )
          .join('\n')
    )
    .join('\n\n')

  const guidance = [
    ...new Set(
      work.files.flatMap((f) => f.findings.map((x) => x.guidance)).filter(Boolean)
    )
  ].join('\n\n')

  return `Convert this custom-node pack off the deprecated ComfyUI APIs and onto the published node API.

Pack: ${work.pack}
Files needing conversion: ${work.files.length} of ${work.readable.length} JS files.

The mechanical rules found these and declined to rewrite them:

${perFile}

Guidance for exactly these patterns:

${guidance}

${references(work)}

Full source of every file in scope:

${inlineSources(work)}

Workflow:
0. UNDERSTAND THE PACK FIRST, THEN DELEGATE.

   You have every source above and converter subagents to hand out work to.
   Do not start converting file by file, and do not hand out files cold — a
   converter that has to rediscover what the pack is will spend its first turns
   doing what you have already done.

   First, read the whole pack and work out:
     - what it is for, and which node types it registers
     - which files are shared helpers, and who calls them
     - the recurring construct: most packs do one or two things repeatedly, and
       the conversion is the same shape every time
     - which files are coupled, and which are independent

   Then group the files. Files sharing a contract — a helper and its callers, a
   caller and its callee — go to the SAME converter, or one will change a
   signature the other is still calling. Independent groups go to different
   converters and run at once.

   Then brief each converter in its Task prompt. Give it the head start you
   now have:
     - what the pack does and what its node types are
     - its files, and why they were grouped together
     - the pack's shared helpers and their contracts, including any it must not
       change without changing callers it does not own
     - the conversion pattern you established — if you converted a file
       yourself, show it as the worked example to follow
     - the specific traps in its files

   Convert one representative file yourself first. It settles the pattern,
   and it makes every briefing concrete instead of theoretical. Then delegate
   the rest, several converters at a time, until every file is resolved.
1. The sources and findings above are complete — do not call list_files,
   findings_for, or read_file for anything already shown. read_file is for
   siblings you need and files marked too large. Files in a pack import each
   other and share helpers — read the siblings a conversion's contract touches.
2. Per file: decide whether it is convertible. Check whether each object is a
   live node or serialized workflow data before touching anything.
3. write_conversion, then run_checks, and fix whatever fails.
3b. verify_pack once the pack's drafts are in place — it actually runs the code,
   and it is the only check that can catch a break spanning files.
4. mark_complete, or give_up with the category that fits. Batch punts: once you
   have surveyed the pack, give_up every clearly-blocked file in ONE call
   rather than one per turn. Batch independent tool calls generally — several
   read_file calls in one turn cost one round trip, not several.
5. suggest_skill_note for anything you had to work out that is not already in
   the skill — a mapping that was not written down, a distinction that would
   have misled you, a trap you nearly fell into. This applies whether you
   converted or gave up; a punt often teaches the most. Do not restate what the
   skill already says.
5. Resolve every file listed above before finishing. A converter reporting
   success is not resolution — only mark_complete or give_up records anything,
   and a converter that wrote a draft without calling one has produced nothing.
   Every tool response tells you what is still outstanding: if a converter
   comes back and files it owned are still listed, re-delegate them or resolve
   them yourself. Do not finish while anything remains.

If a helper is duplicated across files, convert it consistently — the same
construct should get the same treatment everywhere in the pack.

You may read and convert ANY file in the pack, not only the ones listed. If you
change an exported function's signature, you must also convert every caller of
it in the pack — otherwise the pack is broken at runtime even though each file
passes its own checks. \`mark_complete\` refuses when callers are left stranded.

Do not add a compatibility shim.

Keep the diff small — it is the message. These patches are read by the pack's
author, often as a pull request. A patch touching ten lines says "we moved you
off two deprecated calls"; one that rewrites the file says "we rewrote your
code", and it gets rejected on sight even when correct.

So: change the registration and leave everything else exactly where it is. Do
not hoist, reorder or rename anything the conversion does not require — keep
helpers nested where they were nested, keep their names and parameters, keep
the file's quote style and spacing. Do not fix adjacent code.

On indentation: the patch is applied to the author's working tree, so shrinking
the diff by leaving code at its old depth ships them badly indented source, and
that is worse than a bigger diff. Match the original indentation wherever the
nesting did not change; re-indent properly where it did — removing a wrapper
takes two levels off its body and the result has to be correct. What to avoid
is re-indenting anything whose nesting did not change.

Punt rather than force a conversion when any of these hold:

- The approach has no equivalent under Nodes 2.0 or ECS — a hand-painted
  interactive canvas control, a node that patches another pack's prototype, a
  widget whose behaviour depends on canvas draw order. These need the author.
  Use "incompatible".
- The published API has no destination for something the file needs. Use
  "api-gap" and name the missing capability.
- You cannot tell whether an object is a live node or serialized workflow data.
  Use "ambiguous" rather than guessing — that guess corrupts working code.

An accurate punt beats an attempted conversion. Name the specific construct in
\`detail\`; that text becomes the work item for whoever picks it up.`
}

// ---------------------------------------------------------------------------
// Per-pack session
// ---------------------------------------------------------------------------

function createSession(work, tracePath, db) {
  const state = {
    drafts: new Map(),
    tests: new Map(),
    verified: new Map(),
    reports: new Map(),
    outcomes: new Map(),
    // Proposed skill additions. Collected rather than applied: a tip is only
    // worth carrying if it holds beyond the pack that produced it, and that
    // is a judgement made across runs, not inside one.
    skillNotes: []
  }

  const byName = new Map(work.readable.map((p) => [relative(work.root, p), p]))
  const resolve = (path) =>
    byName.get(path) ??
    work.readable.find((p) => p.endsWith(`/${path}`) || p === path)

  const remaining = () => {
    const left = work.files
      .filter((f) => !state.outcomes.has(f.name))
      .map((f) => f.name)
    return left.length ? `Remaining: ${left.join(', ')}` : 'All files resolved.'
  }
  const say = (text) => ({ content: [{ type: 'text', text }] })

  /**
   * Times every tool call.
   *
   * Conversions take minutes and it was guesswork which part — reading the
   * pack, re-running checks, waiting on the two verify_pack subprocesses. The
   * trace makes it measurable, and anything that turns out to dominate can be
   * computed once up front instead of on demand.
   */
  const trace = (name, ms, extra = {}) => {
    if (!tracePath) return
    appendFileSync(
      tracePath,
      JSON.stringify({ pack: work.pack, tool: name, ms, ...extra }) + '\n'
    )
  }
  const tool = (name, description, schema, handler) =>
    rawTool(name, description, schema, async (...args) => {
      const started = Date.now()
      try {
        return await handler(...args)
      } finally {
        trace(name, Date.now() - started)
      }
    })

  const server = createSdkMcpServer({
    name: 'magicpatch',
    version: '1.0.0',
    tools: [
      tool(
        'list_files',
        'List every JS file in this pack, flagging which need converting.',
        {},
        async () =>
          say(
            work.readable
              .map((p) => {
                const name = relative(work.root, p)
                const needs = work.files.some((f) => f.name === name)
                const done = state.outcomes.has(name) ? ' (done)' : ''
                return `${needs ? 'CONVERT' : '   read'}${done}  ${name}`
              })
              .sort()
              .join('\n')
          )
      ),

      tool(
        'read_file',
        'Read any file in this pack, including siblings you are not converting. Read what an escalated file imports before converting it — the contract between them is what a per-file conversion gets wrong.',
        { path: z.string().describe('Filename or path within this pack.') },
        async ({ path }) => {
          const full = resolve(path)
          if (!full) return say(`No file ${path} in this pack. Use list_files.`)
          try {
            const text = readFileSync(full, 'utf8')
            return say(
              text.length > MAX_READ_CHARS
                ? text.slice(0, MAX_READ_CHARS) + '\n\n[truncated]'
                : text
            )
          } catch (error) {
            return say(`Could not read ${path}: ${error.message}`)
          }
        }
      ),

      tool(
        'findings_for',
        'What the mechanical rules found in a file, and why they declined it.',
        { path: z.string() },
        async ({ path }) => {
          const file = work.files.find((f) => f.name === path)
          return say(
            file
              ? JSON.stringify(file.findings, null, 2)
              : `No findings recorded for ${path}.`
          )
        }
      ),

      tool(
        'write_conversion',
        'Submit a converted file and its test.',
        {
          path: z.string(),
          converted: z.string().describe('The full converted source.'),
          test: z
            .string()
            .describe(
              'A test with an equivalence section that must pass against BOTH sources, and a fix section expected to fail against the original.'
            )
        },
        async ({ path, converted, test }) => {
          const full = resolve(path)
          if (!full) return say(`No file ${path} in this pack.`)
          const name = relative(work.root, full)
          state.drafts.set(name, converted)
          state.tests.set(name, test)
          state.verified.delete(name)
          return say(`Draft stored for ${name}. Call run_checks next.`)
        }
      ),

      tool(
        'run_checks',
        "Run the conformance harness against a file's current draft.",
        { path: z.string() },
        async ({ path }) => {
          const full = resolve(path)
          const name = full && relative(work.root, full)
          if (!name || !state.drafts.has(name)) {
            return say(`No draft for ${path} — call write_conversion first.`)
          }
          const draft = state.drafts.get(name)
          const report = runConformance({
            pack: work.pack,
            file: name,
            original: readFileSync(full, 'utf8'),
            converted: draft,
            edits: []
          })
          if (report.passed) {
            state.verified.set(name, draft)
            state.reports.set(name, report)
          }
          const remainingFindings = convert(draft)
          return say(
            JSON.stringify(
              {
                passed: report.passed,
                results: report.results,
                remainingFindings: [
                  ...remainingFindings.applied,
                  ...remainingFindings.escalated
                ].map((m) => `${m.rule}@${m.line}: ${m.text}`)
              },
              null,
              2
            )
          )
        }
      ),

      tool(
        'suggest_skill_note',
        'Propose an addition to the conversion skill: a mapping, trap, or distinction you had to work out yourself and that the next conversion would benefit from.',
        {
          reference: z
            .string()
            .describe(
              'Which reference it belongs in: widgets.md, node-definitions.md, draw-callbacks.md, or SKILL.md.'
            ),
          claim: z.string().describe('The tip, stated as one usable sentence.'),
          evidence: z
            .string()
            .describe(
              'The concrete code that taught you this — pack, file and construct.'
            )
        },
        async ({ reference, claim, evidence }) => {
          state.skillNotes.push({ reference, claim, evidence })
          return say(
            `Noted for ${reference}. It is reviewed before being folded into the skill, so state it as something checkable rather than a guess.`
          )
        }
      ),

      tool(
        'verify_pack',
        'Run the whole pack twice — as shipped and with your current drafts — and report what changed. This is the only check that executes the code.',
        {},
        async () => {
          const drafts = Object.fromEntries(state.drafts)
          if (!Object.keys(drafts).length) {
            return say('No drafts yet — call write_conversion first.')
          }
          // Every readable JS file, not just the ones being converted: a
          // signature change is only visible when its callers load too.
          const entries = work.readable
            .map((p) => relative(work.root, p))
            .filter((p) => !p.includes('node_modules'))
          try {
            const result = await verifyPack({
              pack: work.pack,
              packRoot: work.root,
              entries,
              drafts
            })
            return say(
              JSON.stringify(
                {
                  regressed: result.regressed,
                  typesDriven: result.types,
                  loaded: { before: result.before.loaded, after: result.after.loaded },
                  problems: result.problems,
                  newErrors: result.newErrors,
                  wireChanged: result.wireChanged,
                  hint: result.regressed
                    ? 'The converted pack behaves differently. Fix it, or give_up with the reason.'
                    : 'Nothing observable got worse.'
                },
                null,
                2
              )
            )
          } catch (error) {
            return say(`verify_pack could not run: ${error?.message ?? error}`)
          }
        }
      ),

      tool(
        'mark_complete',
        'Mark one file complete. Requires passing checks for its current draft.',
        {
          path: z.string(),
          summary: z.string().describe('One or two sentences on what changed.')
        },
        async ({ path, summary }) => {
          const full = resolve(path)
          const name = full && relative(work.root, full)
          if (!name || !state.drafts.has(name)) {
            return say(`Nothing to complete for ${path}.`)
          }
          if (state.verified.get(name) !== state.drafts.get(name)) {
            return say(
              `Refused: run_checks has not passed for the current draft of ${name}. Run it, fix any failures, then try again.`
            )
          }
          const stranded = strandedCallers(work, state, full, name)
          if (stranded.length) {
            return say(
              `Refused: ${name} changes the signature of ${stranded
                .map((s) => s.export)
                .join(', ')}, but ${[
                ...new Set(stranded.map((s) => s.caller))
              ].join(', ')} still call the old form and have no draft. ` +
                `Convert them too, or restore the original signature. ` +
                `A pack that only half-converts is broken at runtime.`
            )
          }
          const outcome = {
            file: name,
            path: full,
            status: 'converted',
            detail: summary,
            converted: state.drafts.get(name),
            test: state.tests.get(name),
            verified: state.reports.get(name)
          }
          state.outcomes.set(name, outcome)
          // Persisted now, not at pack end. A 25-file session that dies at
          // file 24 used to lose every draft — 31 minutes of work went that
          // way once. The end-of-pack write repeats this idempotently.
          if (db) {
            try {
              writeDbEntry(
                db,
                work,
                packCommit(work.root),
                outcome,
                readFileSync(full, 'utf8')
              )
            } catch (error) {
              console.error(`  persist failed for ${name}: ${error?.message}`)
            }
          }
          return say(`${name} recorded as converted. ${remaining()}`)
        }
      ),

      tool(
        'give_up',
        'Abandon one or more files, recording which kind of blocker each hit. Batch every file you have already decided on into one call — a gap-heavy pack punted one file per turn spends a quarter of its session on this. An accurate category is worth more than a forced conversion.',
        {
          punts: z
            .array(
              z.object({
                path: z.string(),
                category: z.enum(Object.keys(PUNT_REASONS)),
                detail: z
                  .string()
                  .describe(
                    'What specifically blocked it — name the construct, the missing API, or the ambiguity. This becomes the work item.'
                  )
              })
            )
            .min(1)
        },
        async ({ punts }) => {
          const lines = []
          for (const { path, category, detail } of punts) {
            const full = resolve(path)
            const name = full && relative(work.root, full)
            if (!name) {
              lines.push(`No file ${path} in this pack.`)
              continue
            }
            state.outcomes.set(name, {
              file: name,
              status: 'abandoned',
              reason: category,
              detail
            })
            lines.push(`${name} abandoned (${category}).`)
          }
          return say(`${lines.join(' ')} ${remaining()}`)
        }
      )
    ]
  })

  return { state, server }
}

// ---------------------------------------------------------------------------
// Database output
// ---------------------------------------------------------------------------

function packCommit(root) {
  try {
    const { execFileSync } = require('node:child_process')
    const sha = execFileSync('git', ['-C', root, 'rev-parse', '--short=7', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    if (sha) return sha
  } catch {
    // Corpus is a tarball extract rather than a clone. The directory still
    // needs a stable name — "unknown" for every pack would collapse them.
  }
  const names = jsFiles(root)
    .map((p) => relative(root, p))
    .sort()
    .join('\n')
  return 'x' + createHash('sha256').update(names).digest('hex').slice(0, 6)
}

/** Every stored file for this pack/file, whatever commit directory it is under. */
function previousEntries(db, pack, file) {
  const packDir = join(db, pack)
  let commits = []
  try {
    commits = readdirSync(packDir)
  } catch {
    return []
  }
  return commits.flatMap((commit) =>
    ['.json', '.diff']
      .map((extension) => join(packDir, commit, `${file}${extension}`))
      .filter((path) => existsSync(path))
  )
}

function writeDbEntry(db, work, commit, outcome, source) {
  // A re-run supersedes whatever was there before. Without this a corrected
  // conversion sits alongside the version it replaces — and if the pack's
  // fingerprint changed, under a different directory entirely — so the database
  // accumulates entries nobody meant to keep and compile_db reports a conflict
  // between a patch and its own successor.
  for (const stale of previousEntries(db, work.pack, outcome.file)) {
    rmSync(stale, { force: true })
  }

  const target = join(db, work.pack, commit, `${outcome.file}.json`)
  mkdirSync(dirname(target), { recursive: true })

  // The diff is its own file rather than a field. Embedded in JSON it is one
  // escaped line that no tool will render and no reviewer will read; as a
  // sibling `.diff` it is syntax-highlighted everywhere, shows up properly in
  // a pull request, and feeds `patch(1)` directly.
  const diffPath = `${target.replace(/\.json$/, '')}.diff`
  writeFileSync(
    diffPath,
    toUnifiedDiff(
      readFileSync(outcome.path, 'utf8'),
      outcome.converted,
      outcome.file
    )
  )

  writeFileSync(
    target,
    JSON.stringify(
      {
        pack: work.pack,
        commit,
        file: outcome.file,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        apiMajor: API_MAJOR,
        ruleCatalogVersion: RULE_CATALOG_VERSION,
        author: 'agent:claude-code',
        rules: [
          ...new Set(
            work.files
              .filter((f) => f.name === outcome.file)
              .flatMap((f) => f.findings.map((x) => x.rule))
          )
        ].sort(),
        summary: outcome.detail,
        verified: outcome.verified ?? {},
        /** Sibling file holding the conversion as a unified diff. */
        diff: basename(diffPath),
        test: outcome.test ?? null
      },
      null,
      2
    ) + '\n'
  )
  return target
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * Failures that say nothing about the pack.
 *
 * A dropped connection or an exhausted turn budget currently lands in the
 * ledger looking exactly like a considered punt, which quietly corrupts the
 * one dataset this whole exercise produces. A laptop going to sleep mid-run
 * cost two packs before this existed.
 */
/**
 * Failures where retrying is pointless and continuing is harmful.
 *
 * An expired token fails every remaining pack in milliseconds, so a 537-pack
 * batch "completes" in seconds having converted nothing — six parallel runs
 * did exactly that. Stop at the first one and say why.
 */
const FATAL =
  /401|authenticate|not logged in|\/login|invalid.?api.?key|unauthorized|forbidden/i

const TRANSIENT =
  /connection closed|network|ECONNRESET|ETIMEDOUT|socket hang up|maximum number of turns|rate.?limit|overloaded|503|529/i

/** Runs a pack, retrying once when the failure was not the pack's fault. */
class FatalRunError extends Error {}

async function convertPackWithRetry(work, tracePath, attempt = 1) {
  const result = await convertPack(work, tracePath)
  if (result.status === 'failed' && FATAL.test(result.detail ?? '')) {
    throw new FatalRunError(result.detail)
  }
  if (
    result.status === 'failed' &&
    attempt < 3 &&
    TRANSIENT.test(result.detail ?? '')
  ) {
    console.error(
      `  ${work.pack}: transient failure (${result.detail?.slice(0, 60)}), retrying (${attempt + 1}/3)`
    )
    return convertPackWithRetry(work, tracePath, attempt + 1)
  }
  // Marked so a reader can tell "we could not run this" from "we looked and
  // decided not to convert it".
  if (result.status === 'failed' && TRANSIENT.test(result.detail ?? '')) {
    return { ...result, status: 'infrastructure-failure' }
  }
  return result
}

async function convertPack(work, tracePath) {
  const { state, server } = createSession(
    work,
    tracePath,
    tracePath ? dirname(tracePath) : undefined
  )
  const toolNames = [
    'list_files',
    'read_file',
    'findings_for',
    'write_conversion',
    'run_checks',
    'verify_pack',
    'suggest_skill_note',
    'mark_complete',
    'give_up'
  ].map((n) => `mcp__magicpatch__${n}`)

  const q = query({
    prompt: buildPrompt(work),
    options: {
      model: process.env.MAGIC_PATCH_MODEL || DEFAULT_MODEL,
      systemPrompt: systemPrompt(),
      mcpServers: { magicpatch: server },
      // Our tools plus delegation. Task is the lead's alone — converters get
      // toolNames only, so fan-out stays one level and the lead keeps a single
      // view of what is still unresolved.
      allowedTools: [...toolNames, 'Task'],
      permissionMode: 'bypassPermissions',
      // Crystools exhausted 72 turns mid-conversion on a single file it had
      // previously converted correctly, so the budget was the limit rather
      // than the work. verify_pack also costs turns the old figure predated.
      maxTurns: 120 + work.files.length * 25,
      /**
       * The lead delegates files to converters rather than working the pack
       * serially.
       *
       * Sharding the pack ourselves fixed throughput but picked the split
       * blindly — two files per agent whether they share a helper or have
       * nothing to do with each other. The lead has every source in its
       * prompt, so it can see which files are coupled and split on that,
       * and scale the fan-out to the work rather than to a flag.
       *
       * Converters get the same tools: they own the files they are given, end
       * to end, including the decision to give up.
       */
      agents: {
        converter: {
          description:
            'Converts a set of this pack\'s files off the deprecated APIs. Give it files that belong together — ones sharing a helper, or a caller and its callee — so one agent owns both sides of a contract.',
          tools: toolNames,
          model: process.env.MAGIC_PATCH_MODEL || DEFAULT_MODEL,
          prompt: converterPrompt(work)
        }
      }
    }
  })

  try {
    for await (const message of q) {
      if (state.outcomes.size >= work.files.length) break
    }
  } catch (error) {
    return {
      pack: work.pack,
      status: 'failed',
      detail: String(error?.message ?? error).slice(0, 300),
      files: [...state.outcomes.values()],
      skillNotes: state.skillNotes
    }
  }

  const unresolved = work.files
    .filter((f) => !state.outcomes.has(f.name))
    .map((f) => f.name)
  return {
    pack: work.pack,
    status: unresolved.length ? 'failed' : 'done',
    detail: unresolved.length ? `unresolved: ${unresolved.join(', ')}` : '',
    files: [...state.outcomes.values()],
    skillNotes: state.skillNotes
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? fallback : argv[i + 1]
  }
  const corpus = flag('corpus')
  if (!corpus) {
    console.error(
      'usage: convert.mjs --corpus <dir> [--db <dir>] [--limit N] [--pack NAME] [--parallel N] [--files-per-agent N]'
    )
    process.exit(2)
  }
  const db = flag('db', join(REPO, 'tmp/magic-patch-db'))
  // Guard against `Number('0')` being falsy — `--limit 0` must mean zero packs,
  // not "no limit", or a dry run silently becomes a full spend.
  const limitRaw = flag('limit')
  const limit = limitRaw === undefined ? null : Number(limitRaw)
  const only = flag('pack')
  const dryRun = argv.includes('--dry-run')
  // Conversions are almost entirely model time, so packs run concurrently by
  // default. Four keeps a laptop usable and stays clear of rate limits; raise
  // it on a dedicated machine.
  const parallel = Math.max(1, Number(flag('parallel', '4')))
  // 0 means a whole pack per agent. Small values buy iteration speed at the
  // cost of any single agent seeing the whole pack.
  const filesPerAgent = Math.max(0, Number(flag('files-per-agent', '0')))

  const ledgerPath = join(db, 'ledger.jsonl')
  const done = new Set(
    existsSync(ledgerPath)
      ? readFileSync(ledgerPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line).pack)
      : []
  )

  let packs = detect(corpus).filter((p) => !done.has(p.pack))
  if (only) packs = packs.filter((p) => p.pack === only)
  if (limit !== null) packs = packs.slice(0, limit)

  if (!packs.length) {
    console.log('Nothing to do.')
    return 0
  }
  const fileCount = packs.reduce((n, p) => n + p.files.length, 0)
  console.log(
    `${packs.length} pack(s), ${fileCount} file(s); ${done.size} pack(s) already recorded.`
  )

  if (dryRun) {
    // Detection and prompt assembly without an agent run — the cheap way to see
    // what a batch would attempt before paying for it.
    for (const work of packs) {
      const rules = [
        ...new Set(work.files.flatMap((f) => f.findings.map((x) => x.rule)))
      ].sort()
      console.log(
        `\n${work.pack}  (${work.files.length}/${work.readable.length} files)  ${rules.join(', ')}`
      )
      for (const file of work.files) {
        console.log(`  ${file.name}  ${file.findings.length} finding(s)`)
      }
      console.log(`  prompt: ${buildPrompt(work).length} chars`)
    }
    return 0
  }

  // Auth before work. Three batches have now been lost to a token that expired
  // between launching and running — each one failing every pack in milliseconds
  // and reporting a completed run that converted nothing. One cheap call up
  // front turns that into a clear message before anything is spawned.
  const authed = await new Promise((resolve) => {
    const probe = spawn('claude', ['-p', 'reply OK'], { stdio: 'pipe' })
    let output = ''
    probe.stdout?.on('data', (chunk) => (output += chunk))
    probe.stderr?.on('data', (chunk) => (output += chunk))
    probe.on('error', () => resolve({ ok: false, output: 'claude not runnable' }))
    probe.on('close', (code) =>
      resolve({ ok: code === 0 && !FATAL.test(output), output: output.trim() })
    )
  })
  if (!authed.ok) {
    console.error(`Cannot start: Claude Code is not usable.\n  ${authed.output}`)
    console.error('Re-authenticate (claude /login) and rerun.')
    return 2
  }

  mkdirSync(db, { recursive: true })
  const statuses = {}
  const reasons = {}
  let failed = 0

  /** Everything a finished pack contributes, applied on the main thread. */
  const record = (work, result) => {
    if (result.status === 'failed') failed++

    for (const file of result.files) {
      statuses[file.status] = (statuses[file.status] ?? 0) + 1
      if (file.reason) reasons[file.reason] = (reasons[file.reason] ?? 0) + 1
      if (file.status === 'converted' && file.converted) {
        const source = work.files.find((f) => f.name === file.file)?.path
        if (source) {
          writeDbEntry(db, work, packCommit(work.root), file, readFileSync(source, 'utf8'))
        }
      }
    }

    appendFileSync(ledgerPath, JSON.stringify(result) + '\n')
    const converted = result.files.filter((f) => f.status === 'converted').length
    console.log(
      `[${result.status}] ${work.pack}: ${converted}/${work.files.length} converted ${result.detail}`
    )
  }

  /**
   * Splits a pack across agents when `--files-per-agent` is set.
   *
   * A whole pack per agent is the safer shape — one agent sees every caller of
   * a shared helper — but a 25-file pack is one 20-minute serial run, and at
   * that rate the corpus is weeks. Sharding trades some of that safety for
   * throughput.
   *
   * What holds the safety line: every shard still gets the full pack as
   * readable context, so an agent can read the callers it is about to break;
   * `mark_complete` still refuses a signature change that strands one; and
   * `verify_db` runs over the merged result at the end, where a cross-shard
   * break is visible even though no single agent could see it.
   */
  const shard = (work) => {
    if (!filesPerAgent || work.files.length <= filesPerAgent) return [work]
    const shards = []
    for (let i = 0; i < work.files.length; i += filesPerAgent) {
      shards.push({ ...work, files: work.files.slice(i, i + filesPerAgent) })
    }
    return shards
  }

  const queue = packs.flatMap(shard)
  let fatal = null
  const worker = async () => {
    while (queue.length && !fatal) {
      const work = queue.shift()
      try {
        record(work, await convertPackWithRetry(work, join(db, 'trace.jsonl')))
      } catch (error) {
        if (error instanceof FatalRunError) {
          fatal ??= error
          // Drain, so the remaining packs are not recorded as having been tried.
          queue.length = 0
        } else {
          throw error
        }
      }
    }
  }
  console.error(
    `converting ${packs.length} pack(s) as ${queue.length} unit(s), ` +
      `${parallel} at a time` +
      (filesPerAgent ? `, ${filesPerAgent} file(s) per agent` : '') +
      ` (${process.env.MAGIC_PATCH_MODEL || DEFAULT_MODEL})`
  )
  await Promise.all(
    Array.from({ length: Math.min(parallel, packs.length) }, worker)
  )
  if (fatal) {
    console.error(`\nSTOPPED: ${fatal.message}`)
    console.error('Nothing after this point was attempted. Re-authenticate and rerun.')
    return 2
  }

  console.log(
    '\nfiles:  ' +
      Object.entries(statuses)
        .sort()
        .map(([k, v]) => `${k}: ${v}`)
        .join('  ')
  )
  for (const [reason, count] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${reason.padEnd(13)} ${PUNT_REASONS[reason]}`)
  }
  // Abandonment is an expected outcome, not an error.
  return failed ? 1 : 0
}

main().then((code) => process.exit(code))
