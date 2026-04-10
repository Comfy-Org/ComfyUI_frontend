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
import { resolve, dirname } from 'path'
import { execSync, spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

// ── Load environment from .env.local / .env ──

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) {
    config({ path: envFile })
    break
  }
}

// ── Parse CLI with node:util parseArgs ──

const { values, positionals } = parseArgs({
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

if (values.help) {
  printUsage()
  process.exit(0)
}

const serverUrl =
  values.url || process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188'
const prTarget = (values.target ?? 'head') as 'head' | 'base' | 'both'

// ── Handle --uncommitted mode ──

if (values.uncommitted) {
  const diff = execSync('git diff && git diff --staged', {
    encoding: 'utf-8'
  })
  if (!diff.trim()) {
    console.error('No uncommitted changes found')
    process.exit(1)
  }

  const outputDir = values.output
    ? resolve(values.output)
    : resolve('.comfy-qa/local')
  mkdirSync(outputDir, { recursive: true })

  const tmpDir = resolve(outputDir, '.tmp')
  mkdirSync(tmpDir, { recursive: true })
  const diffFile = resolve(tmpDir, 'uncommitted.diff')
  writeFileSync(diffFile, diff)

  console.warn('QA target: uncommitted changes')
  console.warn(`Output:    ${outputDir}`)
  console.warn(`Server:    ${serverUrl}`)

  const exitCode = runQaRecord('after', diffFile, outputDir)
  printSummary(outputDir)
  process.exit(exitCode)
}

// ── Parse positional target ──

const input = positionals[0]
if (!input) {
  printUsage()
  process.exit(1)
}

type TargetType = 'issue' | 'pr'

let targetType: TargetType | undefined
let number: string
let repo = 'Comfy-Org/ComfyUI_frontend'

const ghUrlMatch = input.match(
  /github\.com\/([^/]+\/[^/]+)\/(issues|pull)\/(\d+)/
)

if (ghUrlMatch) {
  repo = ghUrlMatch[1]
  targetType = ghUrlMatch[2] === 'pull' ? 'pr' : 'issue'
  number = ghUrlMatch[3]
} else if (/^\d+$/.test(input)) {
  number = input
} else {
  console.error(`Cannot parse target: ${input}`)
  console.error('Expected a GitHub URL or number')
  process.exit(1)
}

// Auto-detect issue vs PR when only a number is given
if (!targetType) {
  try {
    execSync(`gh pr view ${number} --repo ${repo} --json number`, {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe']
    })
    targetType = 'pr'
  } catch {
    targetType = 'issue'
  }
}

// ── Set up output directory ──

const outputDir = values.output
  ? resolve(values.output)
  : resolve(`.comfy-qa/${number}`)

mkdirSync(outputDir, { recursive: true })

console.warn(`QA target: ${targetType} #${number} (${repo})`)
console.warn(`Output:    ${outputDir}`)
console.warn(`Server:    ${serverUrl}`)
if (values.ref) console.warn(`Ref:       ${values.ref}`)
if (targetType === 'pr') console.warn(`Target:    ${prTarget}`)

// ── Fetch issue/PR data via gh CLI ──

const tmpDir = resolve(outputDir, '.tmp')
mkdirSync(tmpDir, { recursive: true })

let diffFile: string

if (targetType === 'issue') {
  console.warn(`Fetching issue #${number}...`)
  const body = execSync(
    `gh issue view ${number} --repo ${repo} --json title,body,labels --jq '"Title: " + .title + "\\n\\nLabels: " + ([.labels[].name] | join(", ")) + "\\n\\n" + .body'`,
    { encoding: 'utf-8', timeout: 30000 }
  )
  diffFile = resolve(tmpDir, `issue-${number}.txt`)
  writeFileSync(diffFile, body)
} else {
  console.warn(`Fetching PR #${number}...`)
  const prJson = execSync(
    `gh pr view ${number} --repo ${repo} --json title,body,baseRefName,headRefName,baseRefOid,headRefOid`,
    { encoding: 'utf-8', timeout: 30000 }
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
    diff = execSync(`gh pr diff ${number} --repo ${repo}`, {
      encoding: 'utf-8',
      timeout: 30000
    })
  } catch {
    console.warn('Could not fetch PR diff (PR may be closed/merged)')
  }
  diffFile = resolve(tmpDir, `pr-${number}.txt`)
  writeFileSync(
    diffFile,
    `Title: ${pr.title}\n\n${pr.body}\n\n--- DIFF ---\n\n${diff}`
  )

  writeFileSync(
    resolve(tmpDir, 'refs.json'),
    JSON.stringify(
      {
        base: { ref: pr.baseRefName, sha: pr.baseRefOid },
        head: { ref: pr.headRefName, sha: pr.headRefOid }
      },
      null,
      2
    )
  )
}

// ── Run QA ──

let exitCode = 0

if (targetType === 'issue') {
  exitCode = runQaRecord('reproduce', diffFile, outputDir)
} else if (prTarget === 'both') {
  console.warn('\n=== Phase 1: Reproduce bug on base ===')
  const baseDir = resolve(outputDir, 'base')
  mkdirSync(baseDir, { recursive: true })
  const baseCode = runQaRecord('before', diffFile, baseDir)
  if (baseCode !== 0) {
    console.warn('Base phase failed, continuing to head phase...')
  }

  console.warn('\n=== Phase 2: Demonstrate fix on head ===')
  const headDir = resolve(outputDir, 'head')
  mkdirSync(headDir, { recursive: true })
  exitCode = runQaRecord('after', diffFile, headDir)
} else if (prTarget === 'base') {
  exitCode = runQaRecord('before', diffFile, outputDir)
} else {
  exitCode = runQaRecord('after', diffFile, outputDir)
}

printSummary(outputDir)
process.exit(exitCode)

// ── Helpers ──

function runQaRecord(
  qaMode: string,
  qaDiffFile: string,
  qaOutputDir: string
): number {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const recordScript = resolve(scriptDir, 'qa-record.ts')

  const cmd = [
    'pnpm',
    'exec',
    'tsx',
    recordScript,
    '--mode',
    qaMode,
    '--diff',
    qaDiffFile,
    '--output-dir',
    qaOutputDir,
    '--url',
    serverUrl
  ]

  console.warn(`\nStarting QA ${qaMode} mode...\n`)

  const r = spawnSync(cmd[0], cmd.slice(1), {
    stdio: 'inherit',
    env: process.env
  })
  return r.status ?? 1
}

function printSummary(dir: string) {
  console.warn('\n=== QA Complete ===')
  console.warn(`Results: ${dir}`)
  try {
    const files = execSync(`ls -la "${dir}"`, { encoding: 'utf-8' })
    console.warn(files)
  } catch {
    // not critical
  }
}

function printUsage() {
  console.warn(`
QA CLI — Reproduce issues & test PRs for ComfyUI frontend

Usage:
  pnpm qa <number|url> [options]
  pnpm qa --uncommitted

Targets:
  10253              Number (auto-detects issue vs PR)
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
