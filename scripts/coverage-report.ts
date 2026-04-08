import { existsSync, readFileSync } from 'node:fs'

/**
 * Generates a markdown coverage report from lcov data.
 * Output format matches the unified PR report style (size + perf sections).
 */

const lcovPath = process.argv[2] || 'coverage/playwright/coverage.lcov'

if (!existsSync(lcovPath)) {
  process.stdout.write(
    '## 🔬 E2E Coverage\n\n> ⚠️ No coverage data found. Check the CI workflow logs.\n'
  )
  process.exit(0)
}

const lcov = readFileSync(lcovPath, 'utf-8')

// Parse lcov summary
let totalLines = 0
let coveredLines = 0
let totalFunctions = 0
let coveredFunctions = 0
let totalBranches = 0
let coveredBranches = 0

const fileStats = new Map<string, { lines: number; covered: number }>()
let currentFile = ''

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3)
  } else if (line.startsWith('LF:')) {
    const n = parseInt(line.slice(3), 10)
    totalLines += n
    const entry = fileStats.get(currentFile) ?? { lines: 0, covered: 0 }
    entry.lines = n
    fileStats.set(currentFile, entry)
  } else if (line.startsWith('LH:')) {
    const n = parseInt(line.slice(3), 10)
    coveredLines += n
    const entry = fileStats.get(currentFile) ?? { lines: 0, covered: 0 }
    entry.covered = n
    fileStats.set(currentFile, entry)
  } else if (line.startsWith('FNF:')) {
    totalFunctions += parseInt(line.slice(4), 10)
  } else if (line.startsWith('FNH:')) {
    coveredFunctions += parseInt(line.slice(4), 10)
  } else if (line.startsWith('BRF:')) {
    totalBranches += parseInt(line.slice(4), 10)
  } else if (line.startsWith('BRH:')) {
    coveredBranches += parseInt(line.slice(4), 10)
  }
}

function pct(covered: number, total: number): string {
  if (total === 0) return '—'
  return ((covered / total) * 100).toFixed(1) + '%'
}

function bar(covered: number, total: number): string {
  if (total === 0) return '—'
  const p = (covered / total) * 100
  if (p >= 80) return '🟢'
  if (p >= 50) return '🟡'
  return '🔴'
}

const output: string[] = []
output.push('## 🔬 E2E Coverage')
output.push('')
output.push('| Metric | Covered | Total | Pct | |')
output.push('|---|--:|--:|--:|---|')
output.push(
  `| Lines | ${coveredLines.toLocaleString()} | ${totalLines.toLocaleString()} | ${pct(coveredLines, totalLines)} | ${bar(coveredLines, totalLines)} |`
)
output.push(
  `| Functions | ${coveredFunctions.toLocaleString()} | ${totalFunctions.toLocaleString()} | ${pct(coveredFunctions, totalFunctions)} | ${bar(coveredFunctions, totalFunctions)} |`
)
output.push(
  `| Branches | ${coveredBranches.toLocaleString()} | ${totalBranches.toLocaleString()} | ${pct(coveredBranches, totalBranches)} | ${bar(coveredBranches, totalBranches)} |`
)

// Top uncovered files
const uncovered = [...fileStats.entries()]
  .filter(([, s]) => s.lines > 0)
  .map(([file, s]) => ({
    file: file.replace(/^.*\/src\//, 'src/'),
    pct: (s.covered / s.lines) * 100,
    missed: s.lines - s.covered
  }))
  .filter((f) => f.missed > 0)
  .sort((a, b) => b.missed - a.missed)
  .slice(0, 10)

if (uncovered.length > 0) {
  output.push('')
  output.push('<details>')
  output.push('<summary>Top 10 files by uncovered lines</summary>')
  output.push('')
  output.push('| File | Coverage | Missed |')
  output.push('|---|--:|--:|')
  for (const f of uncovered) {
    output.push(`| \`${f.file}\` | ${f.pct.toFixed(1)}% | ${f.missed} |`)
  }
  output.push('')
  output.push('</details>')
}

process.stdout.write(output.join('\n') + '\n')
