#!/usr/bin/env tsx
/**
 * QA CLI — simplified entry point for local & CI QA runs
 *
 * Usage:
 *   pnpm qa 10253                         # auto-detects issue vs PR
 *   pnpm qa https://github.com/.../pull/10270
 *   pnpm qa 10270 -t base                 # test PR base (reproduce bug)
 *   pnpm qa 10270 -t both                 # test base + head
 *   pnpm qa --uncommitted                 # test local uncommitted changes
 *
 * Automatically loads .env.local / .env for GEMINI_API_KEY, ANTHROPIC_API_KEY.
 * Results are written to .comfy-qa/<number>/ by default.
 */

import { parseArgs } from 'node:util'
import { config } from 'dotenv'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { execSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

// ── Constants ──

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const RECORD_SCRIPT = resolve(SCRIPT_DIR, 'qa-record.ts')
const DEFAULT_REPO = 'Comfy-Org/ComfyUI_frontend'
const VALID_TARGETS = ['head', 'base', 'both'] as const
type PrTarget = (typeof VALID_TARGETS)[number]
type TargetType = 'issue' | 'pr'

// ── Load .env.local / .env ──

for (const f of ['.env.local', '.env']) {
  if (existsSync(f)) {
    config({ path: f })
    break
  }
}

// ── Parse CLI ──

const { values, positionals } = tryParseArgs()

if (values.help) {
  printUsage()
  process.exit(0)
}

const serverUrl =
  values.url || process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188'

const prTarget = values.target as PrTarget
if (!VALID_TARGETS.includes(prTarget)) {
  console.error(
    `Invalid --target "${prTarget}". Must be one of: ${VALID_TARGETS.join(', ')}`
  )
  process.exit(1)
}

// ── Dispatch by mode ──

if (values.uncommitted) {
  runUncommitted()
} else {
  const input = positionals[0]
  if (!input) {
    printUsage()
    process.exit(1)
  }
  runTarget(input)
}

// ── Mode: uncommitted changes ──

function runUncommitted(): never {
  const diff = shell('git diff && git diff --staged')
  if (!diff.trim()) {
    console.error('No uncommitted changes found')
    process.exit(1)
  }

  const outputDir = resolveOutputDir('.comfy-qa/local')
  const diffFile = writeTmpFile(outputDir, 'uncommitted.diff', diff)

  logHeader({ label: 'uncommitted changes', outputDir })
  const code = runQaRecord('after', diffFile, outputDir)
  exit(code, outputDir)
}

// ── Mode: issue or PR by number/URL ──

function runTarget(input: string): never {
  const { targetType, number, repo } = resolveTarget(input)
  const outputDir = resolveOutputDir(`.comfy-qa/${number}`)

  logHeader({
    label: `${targetType} #${number} (${repo})`,
    outputDir,
    extra: targetType === 'pr' ? `Target:    ${prTarget}` : undefined
  })

  const diffFile =
    targetType === 'issue'
      ? fetchIssue(number, repo, outputDir)
      : fetchPR(number, repo, outputDir)

  let exitCode: number
  if (targetType === 'issue') {
    exitCode = runQaRecord('reproduce', diffFile, outputDir)
  } else if (prTarget === 'both') {
    exitCode = runPrBoth(diffFile, outputDir)
  } else if (prTarget === 'base') {
    exitCode = runQaRecord('before', diffFile, outputDir)
  } else {
    exitCode = runQaRecord('after', diffFile, outputDir)
  }

  exit(exitCode, outputDir)
}

// ── PR both phases ──

function runPrBoth(diffFile: string, outputDir: string): number {
  console.warn('\n=== Phase 1: Reproduce bug on base ===')
  const baseDir = resolve(outputDir, 'base')
  mkdirSync(baseDir, { recursive: true })
  const baseCode = runQaRecord('before', diffFile, baseDir)
  if (baseCode !== 0) {
    console.warn('Base phase failed, continuing to head...')
  }

  console.warn('\n=== Phase 2: Demonstrate fix on head ===')
  const headDir = resolve(outputDir, 'head')
  mkdirSync(headDir, { recursive: true })
  return runQaRecord('after', diffFile, headDir)
}

// ── Target resolution ──

function resolveTarget(input: string): {
  targetType: TargetType
  number: string
  repo: string
} {
  const urlMatch = input.match(
    /github\.com\/([^/]+\/[^/]+)\/(issues|pull)\/(\d+)/
  )

  if (urlMatch) {
    return {
      repo: urlMatch[1],
      targetType: urlMatch[2] === 'pull' ? 'pr' : 'issue',
      number: urlMatch[3]
    }
  }

  if (/^\d+$/.test(input)) {
    return {
      repo: DEFAULT_REPO,
      targetType: detectType(input, DEFAULT_REPO),
      number: input
    }
  }

  console.error(`Cannot parse target: ${input}`)
  console.error('Expected a GitHub URL or issue/PR number')
  printUsage()
  process.exit(1)
}

function detectType(number: string, repo: string): TargetType {
  try {
    execSync(`gh pr view ${number} --repo ${repo} --json number`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return 'pr'
  } catch {
    return 'issue'
  }
}

// ── Data fetching ──

function fetchIssue(number: string, repo: string, outputDir: string): string {
  console.warn(`Fetching issue #${number}...`)
  const body = shell(
    `gh issue view ${number} --repo ${repo} --json title,body,labels --jq '"Title: " + .title + "\\n\\nLabels: " + ([.labels[].name] | join(", ")) + "\\n\\n" + .body'`
  )
  return writeTmpFile(outputDir, `issue-${number}.txt`, body)
}

function fetchPR(number: string, repo: string, outputDir: string): string {
  console.warn(`Fetching PR #${number}...`)
  const prJson = shell(
    `gh pr view ${number} --repo ${repo} --json title,body,baseRefName,headRefName,baseRefOid,headRefOid`
  )
  const pr = JSON.parse(prJson) as {
    title: string
    body: string
    baseRefName: string
    headRefName: string
    baseRefOid: string
    headRefOid: string
  }

  console.warn(`  Base: ${pr.baseRefName} (${pr.baseRefOid.slice(0, 8)})`)
  console.warn(`  Head: ${pr.headRefName} (${pr.headRefOid.slice(0, 8)})`)

  let diff = ''
  try {
    diff = shell(`gh pr diff ${number} --repo ${repo}`)
  } catch {
    console.warn('Could not fetch PR diff')
  }

  writeTmpFile(
    outputDir,
    'refs.json',
    JSON.stringify(
      {
        base: { ref: pr.baseRefName, sha: pr.baseRefOid },
        head: { ref: pr.headRefName, sha: pr.headRefOid }
      },
      null,
      2
    )
  )

  return writeTmpFile(
    outputDir,
    `pr-${number}.txt`,
    `Title: ${pr.title}\n\n${pr.body}\n\n--- DIFF ---\n\n${diff}`
  )
}

// ── QA record runner ──

function runQaRecord(
  mode: string,
  diffFile: string,
  outputDir: string
): number {
  console.warn(`\nStarting QA ${mode} mode...\n`)
  const r = spawnSync(
    'pnpm',
    [
      'exec',
      'tsx',
      RECORD_SCRIPT,
      '--mode',
      mode,
      '--diff',
      diffFile,
      '--output-dir',
      outputDir,
      '--url',
      serverUrl
    ],
    { stdio: 'inherit', env: process.env }
  )
  return r.status ?? 1
}

// ── Utilities ──

function shell(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 30000 })
}

function writeTmpFile(
  outputDir: string,
  filename: string,
  content: string
): string {
  const tmpDir = resolve(outputDir, '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const filePath = resolve(tmpDir, filename)
  writeFileSync(filePath, content)
  return filePath
}

function resolveOutputDir(defaultPath: string): string {
  const dir = values.output ? resolve(values.output) : resolve(defaultPath)
  mkdirSync(dir, { recursive: true })
  return dir
}

function logHeader(opts: { label: string; outputDir: string; extra?: string }) {
  console.warn(`QA target: ${opts.label}`)
  console.warn(`Output:    ${opts.outputDir}`)
  console.warn(`Server:    ${serverUrl}`)
  if (values.ref) console.warn(`Ref:       ${values.ref}`)
  if (opts.extra) console.warn(opts.extra)
}

function exit(code: number, outputDir: string): never {
  console.warn('\n=== QA Complete ===')
  console.warn(`Results: ${outputDir}`)
  try {
    console.warn(shell(`ls -la "${outputDir}"`))
  } catch {
    // not critical
  }
  process.exit(code)
}

function tryParseArgs() {
  try {
    const parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        target: { type: 'string', short: 't', default: 'head' },
        uncommitted: { type: 'boolean', default: false },
        url: { type: 'string', default: '' },
        ref: { type: 'string', default: '' },
        output: { type: 'string', short: 'o', default: '' },
        help: { type: 'boolean', short: 'h', default: false }
      },
      allowPositionals: true,
      strict: true
    })
    return {
      values: parsed.values as {
        target: string
        uncommitted: boolean
        url: string
        ref: string
        output: string
        help: boolean
      },
      positionals: parsed.positionals
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}\n`)
    printUsage()
    process.exit(1)
  }
}

function printUsage() {
  console.warn(`
QA CLI — Reproduce issues & test PRs for ComfyUI frontend

Usage:
  pnpm qa <number|url> [options]
  pnpm qa --uncommitted

Targets:
  10253              Number (auto-detects issue vs PR via gh CLI)
  https://github.com/Comfy-Org/ComfyUI_frontend/issues/10253
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/10270

Options:
  -t, --target <head|base|both>
                     For PRs: which ref to test (default: head)
                       head  — test the fix (PR head)
                       base  — reproduce the bug (PR base)
                       both  — base then head
  --uncommitted      Test local uncommitted changes
  --url <url>        ComfyUI server URL (default: from .env or http://127.0.0.1:8188)
  --ref <ref>        Git ref to test against
  -o, --output <dir> Override output directory (default: .comfy-qa/<number>)
  -h, --help         Show this help

Environment (auto-loaded from .env.local or .env):
  GEMINI_API_KEY     Required — used for PR analysis, video review, TTS
  ANTHROPIC_API_KEY  Optional locally — Claude Agent SDK auto-detects Claude Code session

Examples:
  pnpm qa 10253                  # reproduce an issue
  pnpm qa 10270                  # test PR head (the fix)
  pnpm qa 10270 -t base          # reproduce bug on PR base
  pnpm qa 10270 -t both          # test base + head
  pnpm qa --uncommitted          # test local changes
`)
}
