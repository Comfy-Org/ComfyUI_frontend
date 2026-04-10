#!/usr/bin/env tsx
/**
 * QA CLI — simplified entry point for local & CI QA runs
 *
 * Usage:
 *   pnpm qa https://github.com/Comfy-Org/ComfyUI_frontend/issues/10253
 *   pnpm qa https://github.com/Comfy-Org/ComfyUI_frontend/pull/10270
 *   pnpm qa 10253                  # auto-detects issue vs PR
 *   pnpm qa <url> --ref=abc123     # pin to a specific commit/branch
 *   pnpm qa <url> --url=http://...  # custom ComfyUI server URL
 *
 * Automatically loads .env.local / .env for GEMINI_API_KEY, ANTHROPIC_API_KEY.
 * Results are written to .comfy-qa/<type>-<number>/ by default.
 */

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

// ── Parse CLI ──

const args = process.argv.slice(2)
let target = ''
let ref = ''
let serverUrl = process.env.DEV_SERVER_COMFYUI_URL || 'http://127.0.0.1:8188'
let outputBase = ''
let includeBase = false

for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--help' || arg === '-h') {
    printUsage()
    process.exit(0)
  } else if (arg === '--base') {
    includeBase = true
  } else if (arg.startsWith('--ref=')) {
    ref = arg.slice(6)
  } else if (arg === '--ref') {
    ref = args[++i]
  } else if (arg.startsWith('--url=')) {
    serverUrl = arg.slice(6)
  } else if (arg === '--url') {
    serverUrl = args[++i]
  } else if (arg.startsWith('--output=')) {
    outputBase = arg.slice(9)
  } else if (arg === '--output') {
    outputBase = args[++i]
  } else if (!arg.startsWith('-')) {
    target = arg
  }
}

if (!target) {
  printUsage()
  process.exit(1)
}

// ── Parse target into type + number ──

type TargetType = 'issue' | 'pr'

let targetType: TargetType | undefined
let number: string
let repo = 'Comfy-Org/ComfyUI_frontend'

const ghUrlMatch = target.match(
  /github\.com\/([^/]+\/[^/]+)\/(issues|pull)\/(\d+)/
)

if (ghUrlMatch) {
  repo = ghUrlMatch[1]
  targetType = ghUrlMatch[2] === 'pull' ? 'pr' : 'issue'
  number = ghUrlMatch[3]
} else if (/^\d+$/.test(target)) {
  number = target
} else {
  console.error(`Cannot parse target: ${target}`)
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

const outputDir = outputBase || resolve(`.comfy-qa/${number}`)

mkdirSync(outputDir, { recursive: true })

console.warn(`QA target: ${targetType} #${number} (${repo})`)
console.warn(`Output:    ${outputDir}`)
console.warn(`Server:    ${serverUrl}`)
if (ref) console.warn(`Ref:       ${ref}`)

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
  // Fetch PR metadata + diff + refs
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

  // Save refs for potential before/after runs
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

// ── Determine mode ──
// Issue → reproduce (find & prove the bug on current code)
// PR default → after (demonstrate the fix on head)
// PR --base → also run before (reproduce bug on base) first

const scriptDir = dirname(fileURLToPath(import.meta.url))
const recordScript = resolve(scriptDir, 'qa-record.ts')

function runQaRecord(qaMode: string, qaOutputDir: string): number {
  const cmd = [
    'pnpm',
    'exec',
    'tsx',
    recordScript,
    '--mode',
    qaMode,
    '--diff',
    diffFile,
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

let exitCode = 0

if (targetType === 'issue') {
  exitCode = runQaRecord('reproduce', outputDir)
} else if (includeBase) {
  // PR with --base: run both phases
  console.warn('\n=== Phase 1: Reproduce bug on base ===')
  const baseDir = resolve(outputDir, 'base')
  mkdirSync(baseDir, { recursive: true })
  const baseCode = runQaRecord('before', baseDir)
  if (baseCode !== 0) {
    console.warn('Base phase failed, continuing to head phase...')
  }

  console.warn('\n=== Phase 2: Demonstrate fix on head ===')
  const headDir = resolve(outputDir, 'head')
  mkdirSync(headDir, { recursive: true })
  exitCode = runQaRecord('after', headDir)
} else {
  // PR default: just test the head (current state)
  exitCode = runQaRecord('after', outputDir)
}

const result = { status: exitCode }

// ── Summary ──

console.warn('\n=== QA Complete ===')
console.warn(`Results: ${outputDir}`)

try {
  const files = execSync(`ls -la "${outputDir}"`, { encoding: 'utf-8' })
  console.warn(files)
} catch {
  // directory listing failed, not critical
}

process.exit(result.status ?? 1)

// ── Helpers ──

function printUsage() {
  console.warn(`
QA CLI — Reproduce issues & test PRs for ComfyUI frontend

Usage:
  pnpm qa <target> [options]

Targets:
  https://github.com/Comfy-Org/ComfyUI_frontend/issues/10253
  https://github.com/Comfy-Org/ComfyUI_frontend/pull/10270
  10253              Number (auto-detects issue vs PR)

Options:
  --base             For PRs: also test the base ref (reproduce bug before fix)
  --url=<url>        ComfyUI server URL (default: from .env or http://127.0.0.1:8188)
  --ref=<ref>        Git ref to test against (commit hash or branch)
  --output=<dir>     Override output directory (default: .comfy-qa/<number>)
  --help, -h         Show this help

Environment (auto-loaded from .env.local or .env):
  GEMINI_API_KEY     Required — used for PR analysis, video review, TTS
  ANTHROPIC_API_KEY  Optional locally — Claude Agent SDK auto-detects Claude Code session

Examples:
  pnpm qa 10253
  pnpm qa 10270 --url=http://localhost:8188
  pnpm qa https://github.com/Comfy-Org/ComfyUI_frontend/pull/10270 --ref=fix-branch
`)
}
