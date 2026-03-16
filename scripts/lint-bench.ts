/**
 * Lint benchmarking script for measuring ESLint-to-oxlint migration impact.
 *
 * Usage:
 *   pnpm tsx scripts/lint-bench.ts                    # benchmark & compare
 *   pnpm tsx scripts/lint-bench.ts --save-baseline     # save as baseline
 *   pnpm tsx scripts/lint-bench.ts --runs 3            # iteration count
 *   pnpm tsx scripts/lint-bench.ts --warmup            # add a warmup run
 *   pnpm tsx scripts/lint-bench.ts --commands oxlint   # benchmark only oxlint
 *   pnpm tsx scripts/lint-bench.ts --profile-rules     # per-rule ESLint timing
 */
import { execSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

import { computeStats } from './perf-stats'

interface BenchResult {
  label: string
  command: string
  timingsMs: number[]
}

interface BenchReport {
  timestamp: string
  branch: string
  gitSha: string
  runs: number
  results: BenchResult[]
}

const RESULTS_DIR = 'temp/lint-bench'
const BASELINE_FILE = join(RESULTS_DIR, 'baseline.json')
const ESLINT_CACHE = '.eslintcache'

const COMMANDS = [
  { label: 'oxlint', command: 'pnpm oxlint' },
  { label: 'eslint', command: 'pnpm eslint src' }
]

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim()
}

function timeCommand(command: string): number {
  const start = performance.now()
  try {
    execSync(command, { stdio: 'pipe', timeout: 600_000 })
  } catch {
    // Lint commands may exit non-zero; timing is still valid
  }
  return performance.now() - start
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms.toFixed(0)}ms`
}

function formatDelta(baseMs: number, currentMs: number): string {
  const deltaMs = currentMs - baseMs
  const pct = baseMs === 0 ? 0 : (deltaMs / baseMs) * 100
  const sign = deltaMs >= 0 ? '+' : ''
  return `${sign}${formatMs(deltaMs)} (${sign}${pct.toFixed(1)}%)`
}

function benchmark(
  commands: typeof COMMANDS,
  runs: number,
  warmup: boolean
): BenchResult[] {
  return commands.map(({ label, command }) => {
    if (warmup) {
      console.error(`  ${label}: warmup...`)
      if (existsSync(ESLINT_CACHE)) rmSync(ESLINT_CACHE)
      timeCommand(command)
    }

    const timingsMs: number[] = []
    for (let i = 0; i < runs; i++) {
      if (existsSync(ESLINT_CACHE)) rmSync(ESLINT_CACHE)
      const ms = timeCommand(command)
      timingsMs.push(ms)
      console.error(`  ${label} [${i + 1}/${runs}]: ${formatMs(ms)}`)
    }

    return { label, command, timingsMs }
  })
}

function sumMeans(results: BenchResult[]): number {
  return results.reduce((sum, r) => sum + computeStats(r.timingsMs).mean, 0)
}

function printReport(report: BenchReport, baseline?: BenchReport): void {
  const header = [
    '',
    '## Lint Benchmark',
    '',
    `Branch: \`${report.branch}\` (\`${report.gitSha}\`) | Runs: ${report.runs}`,
    ''
  ]

  if (!baseline) {
    const rows = report.results.map((r) => {
      const s = computeStats(r.timingsMs)
      return `| ${r.label} | ${formatMs(s.mean)} | ±${formatMs(s.stddev)} | ${formatMs(s.min)} | ${formatMs(s.max)} |`
    })
    process.stdout.write(
      [
        ...header,
        '| Command | Mean | StdDev | Min | Max |',
        '|---------|------|--------|-----|-----|',
        ...rows,
        `| **total** | **${formatMs(sumMeans(report.results))}** | | | |`,
        '',
        ''
      ].join('\n')
    )
    return
  }

  const baseByLabel = new Map(baseline.results.map((r) => [r.label, r]))
  const rows = report.results.map((r) => {
    const s = computeStats(r.timingsMs)
    const base = baseByLabel.get(r.label)
    const baseMean = base ? computeStats(base.timingsMs).mean : null
    return `| ${r.label} | ${baseMean !== null ? formatMs(baseMean) : '—'} | ${formatMs(s.mean)} | ±${formatMs(s.stddev)} | ${baseMean !== null ? formatDelta(baseMean, s.mean) : 'new'} |`
  })

  process.stdout.write(
    [
      ...header,
      `Baseline: \`${baseline.branch}\` (\`${baseline.gitSha}\`) | Runs: ${baseline.runs}`,
      '',
      '| Command | Baseline | Current | StdDev | Delta |',
      '|---------|----------|---------|--------|-------|',
      ...rows,
      `| **total** | **${formatMs(sumMeans(baseline.results))}** | **${formatMs(sumMeans(report.results))}** | | **${formatDelta(sumMeans(baseline.results), sumMeans(report.results))}** |`,
      '',
      ''
    ].join('\n')
  )
}

function saveJson(path: string, data: BenchReport): void {
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2))
}

interface RuleTiming {
  rule: string
  timeMs: number
  relative: number
}

function parseTimingOutput(stderr: string): RuleTiming[] {
  const rules: RuleTiming[] = []
  const lines = stderr.split('\n')

  for (const line of lines) {
    // Match lines like: "no-multi-spaces         |    52.472 |     6.1%"
    const match = line.match(/^([^|]+?)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s*%/)
    if (!match) continue

    const rule = match[1].trim()
    // Skip the header row
    if (rule === 'Rule' || rule.startsWith(':')) continue

    rules.push({
      rule,
      timeMs: parseFloat(match[2]),
      relative: parseFloat(match[3])
    })
  }

  return rules.sort((a, b) => b.timeMs - a.timeMs)
}

function runWithStderr(
  command: string,
  env?: Record<string, string | undefined>
): string {
  try {
    execSync(command, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600_000
    })
  } catch (e: unknown) {
    // ESLint exits non-zero on lint errors; stderr still has timing data
    const error = e as { stderr?: Buffer | string }
    if (error.stderr) {
      return typeof error.stderr === 'string'
        ? error.stderr
        : error.stderr.toString('utf-8')
    }
  }
  return ''
}

function profileRules(): RuleTiming[] {
  console.error('Profiling ESLint per-rule timing (TIMING=all)...')
  if (existsSync(ESLINT_CACHE)) rmSync(ESLINT_CACHE)

  const stderr = runWithStderr('pnpm eslint src', { TIMING: 'all' })
  return parseTimingOutput(stderr)
}

function printRuleProfile(rules: RuleTiming[], top: number): void {
  const shown = rules.slice(0, top)
  const totalMs = rules.reduce((sum, r) => sum + r.timeMs, 0)
  const branch = git('branch --show-current')
  const gitSha = git('rev-parse --short HEAD')

  const lines = [
    '',
    '## ESLint Per-Rule Timing',
    '',
    `Branch: \`${branch}\` (\`${gitSha}\`) | Rules: ${rules.length} | Total rule time: ${formatMs(totalMs)}`,
    '',
    `| # | Rule | Time | % |`,
    `|---|------|------|---|`,
    ...shown.map(
      (r, i) =>
        `| ${i + 1} | ${r.rule} | ${formatMs(r.timeMs)} | ${r.relative.toFixed(1)}% |`
    ),
    '',
    ''
  ]

  process.stdout.write(lines.join('\n'))
}

interface Args {
  runs: number
  saveBaseline: boolean
  warmup: boolean
  filter?: string
  profileRules: boolean
  top: number
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const parsed: Args = {
    runs: 3,
    saveBaseline: false,
    warmup: false,
    profileRules: false,
    top: 30
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--runs':
        parsed.runs = parseInt(args[++i], 10)
        break
      case '--save-baseline':
        parsed.saveBaseline = true
        break
      case '--warmup':
        parsed.warmup = true
        break
      case '--commands':
        parsed.filter = args[++i]
        break
      case '--profile-rules':
        parsed.profileRules = true
        break
      case '--top':
        parsed.top = parseInt(args[++i], 10)
        break
    }
  }

  return parsed
}

function main() {
  const {
    runs,
    saveBaseline,
    warmup,
    filter,
    profileRules: doProfile,
    top
  } = parseArgs()

  if (doProfile) {
    const rules = profileRules()
    if (rules.length === 0) {
      console.error('No timing data found in ESLint output.')
      process.exit(1)
    }
    printRuleProfile(rules, top)

    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(
      join(RESULTS_DIR, 'rule-profile.json'),
      JSON.stringify(rules, null, 2)
    )
    console.error(
      `Rule profile saved to ${join(RESULTS_DIR, 'rule-profile.json')}`
    )
    return
  }

  const commands = filter
    ? COMMANDS.filter((c) => c.label === filter)
    : COMMANDS

  if (commands.length === 0) {
    console.error(
      `No command matches "${filter}". Available: ${COMMANDS.map((c) => c.label).join(', ')}`
    )
    process.exit(1)
  }

  const branch = git('branch --show-current')
  const gitSha = git('rev-parse --short HEAD')

  console.error(
    `Benchmarking ${commands.length} command(s), ${runs} run(s) each`
  )
  console.error(`Branch: ${branch} (${gitSha})`)

  const report: BenchReport = {
    timestamp: new Date().toISOString(),
    branch,
    gitSha,
    runs,
    results: benchmark(commands, runs, warmup)
  }

  const baseline: BenchReport | undefined =
    !saveBaseline && existsSync(BASELINE_FILE)
      ? JSON.parse(readFileSync(BASELINE_FILE, 'utf-8'))
      : undefined

  printReport(report, baseline)

  const outFile = saveBaseline
    ? BASELINE_FILE
    : join(RESULTS_DIR, 'latest.json')
  saveJson(outFile, report)
  if (saveBaseline) console.error(`Baseline saved to ${BASELINE_FILE}`)
}

main()
