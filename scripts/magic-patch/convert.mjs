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
import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { z } from 'zod'

import { convert } from '../../src/workbench/extensions/magicPatch/conversion/convert'
import { RULES, RULE_CATALOG_VERSION } from '../../src/workbench/extensions/magicPatch/conversion/rules'
import { diffToEdits } from '../../src/workbench/extensions/magicPatch/conversion/edits'
import { runConformance } from '../../src/workbench/extensions/magicPatch/verify/conformance'

const REPO = new URL('../..', import.meta.url).pathname
const SKILL_DIR = join(REPO, '.claude/skills/converting-custom-nodes')
const API_MAJOR = 1
const MODEL = 'claude-opus-5'
const MAX_BYTES = 2_000_000
const MAX_READ_CHARS = 400_000

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
      // Only escalations need an agent — whatever the rules applied is already
      // done, deterministically and for free.
      if (!result.escalated.length) continue

      files.push({
        path,
        name: relative(root, path),
        findings: result.escalated.map((m) => ({
          rule: m.rule,
          line: m.line,
          text: m.text,
          escalation: m.escalation ?? '',
          guidance: guidance.get(m.rule) ?? ''
        }))
      })
    }

    if (files.length) packs.push({ pack, root, files, readable })
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
    ...new Set(
      [...matched].map((rule) => RULE_REFERENCES[rule]).filter(Boolean)
    )
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

Workflow:
1. list_files, then read_file on the files you will convert AND their siblings.
   Files in a pack import each other and share helpers — a conversion that only
   looks at one side of that contract is how this goes wrong.
2. Per file: decide whether it is convertible. Check whether each object is a
   live node or serialized workflow data before touching anything.
3. write_conversion, then run_checks, and fix whatever fails.
4. mark_complete, or give_up with the category that fits.
5. Resolve every file listed above before finishing.

If a helper is duplicated across files, convert it consistently — the same
construct should get the same treatment everywhere in the pack.

You may read and convert ANY file in the pack, not only the ones listed. If you
change an exported function's signature, you must also convert every caller of
it in the pack — otherwise the pack is broken at runtime even though each file
passes its own checks. \`mark_complete\` refuses when callers are left stranded.

Do not add a compatibility shim.

Keep the diff minimal. Change only the lines that must change: preserve the
file's existing quote style, indentation, spacing, semicolons and line breaks
everywhere else, and do not reorder or reflow untouched code. The stored patch
is a line diff against the original, and a reformatted file buries the two lines
that matter in hundreds that do not.

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

function createSession(work) {
  const state = {
    drafts: new Map(),
    tests: new Map(),
    verified: new Map(),
    reports: new Map(),
    outcomes: new Map()
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
          state.outcomes.set(name, {
            file: name,
            path: full,
            status: 'converted',
            detail: summary,
            converted: state.drafts.get(name),
            test: state.tests.get(name),
            verified: state.reports.get(name)
          })
          return say(`${name} recorded as converted. ${remaining()}`)
        }
      ),

      tool(
        'give_up',
        'Abandon one file, recording which kind of blocker it hit. Preferred over guessing — an accurate category is worth more than a forced conversion.',
        {
          path: z.string(),
          category: z.enum(Object.keys(PUNT_REASONS)),
          detail: z
            .string()
            .describe(
              'What specifically blocked it — name the construct, the missing API, or the ambiguity. This becomes the work item.'
            )
        },
        async ({ path, category, detail }) => {
          const full = resolve(path)
          const name = full && relative(work.root, full)
          if (!name) return say(`No file ${path} in this pack.`)
          state.outcomes.set(name, {
            file: name,
            status: 'abandoned',
            reason: category,
            detail
          })
          return say(`${name} abandoned (${category}). ${remaining()}`)
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

function writeDbEntry(db, work, commit, outcome, source) {
  const target = join(db, work.pack, commit, `${outcome.file}.json`)
  mkdirSync(dirname(target), { recursive: true })
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
        // Recovered as a minimal diff rather than stored as a whole file, so
        // the artifact is not a copy of someone else's source and a reviewer
        // sees the conversion instead of a reformatting.
        edits: diffToEdits(readFileSync(outcome.path, 'utf8'), outcome.converted),
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

async function convertPack(work) {
  const { state, server } = createSession(work)
  const toolNames = [
    'list_files',
    'read_file',
    'findings_for',
    'write_conversion',
    'run_checks',
    'mark_complete',
    'give_up'
  ].map((n) => `mcp__magicpatch__${n}`)

  const q = query({
    prompt: buildPrompt(work),
    options: {
      model: MODEL,
      systemPrompt: systemPrompt(),
      mcpServers: { magicpatch: server },
      // Only our tools: the agent must go through the harness rather than
      // editing the corpus on disk or shelling out.
      allowedTools: toolNames,
      permissionMode: 'bypassPermissions',
      maxTurns: 60 + work.files.length * 12
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
      files: [...state.outcomes.values()]
    }
  }

  const unresolved = work.files
    .filter((f) => !state.outcomes.has(f.name))
    .map((f) => f.name)
  return {
    pack: work.pack,
    status: unresolved.length ? 'failed' : 'done',
    detail: unresolved.length ? `unresolved: ${unresolved.join(', ')}` : '',
    files: [...state.outcomes.values()]
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
      'usage: convert.mjs --corpus <dir> [--db <dir>] [--limit N] [--pack NAME]'
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

  mkdirSync(db, { recursive: true })
  const statuses = {}
  const reasons = {}
  let failed = 0

  // Sequential on purpose: each pack is a long agent run, and Claude Code's
  // credentials are shared with whatever else the developer is doing.
  for (const work of packs) {
    const result = await convertPack(work)
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
