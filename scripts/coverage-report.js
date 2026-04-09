// @ts-check
import { existsSync, readFileSync } from 'node:fs'

const lcovPath = process.argv[2] || 'coverage/playwright/coverage.lcov'

if (!existsSync(lcovPath)) {
  process.stdout.write(
    '## 🔬 E2E Coverage\n\n> ⚠️ No coverage data found. Check the CI workflow logs.\n'
  )
  process.exit(0)
}

const lcov = readFileSync(lcovPath, 'utf-8')

let totalLines = 0
let coveredLines = 0
let totalFunctions = 0
let coveredFunctions = 0
let totalBranches = 0
let coveredBranches = 0

/** @type {Map<string, { lines: number, covered: number }>} */
const fileStats = new Map()
let currentFile = ''

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3)
  } else if (line.startsWith('LF:')) {
    const n = parseInt(line.slice(3), 10) || 0
    totalLines += n
    const entry = fileStats.get(currentFile) ?? { lines: 0, covered: 0 }
    entry.lines = n
    fileStats.set(currentFile, entry)
  } else if (line.startsWith('LH:')) {
    const n = parseInt(line.slice(3), 10) || 0
    coveredLines += n
    const entry = fileStats.get(currentFile) ?? { lines: 0, covered: 0 }
    entry.covered = n
    fileStats.set(currentFile, entry)
  } else if (line.startsWith('FNF:')) {
    totalFunctions += parseInt(line.slice(4), 10) || 0
  } else if (line.startsWith('FNH:')) {
    coveredFunctions += parseInt(line.slice(4), 10) || 0
  } else if (line.startsWith('BRF:')) {
    totalBranches += parseInt(line.slice(4), 10) || 0
  } else if (line.startsWith('BRH:')) {
    coveredBranches += parseInt(line.slice(4), 10) || 0
  }
}

/** @param {number} covered @param {number} total */
function pct(covered, total) {
  if (total === 0) return '—'
  return ((covered / total) * 100).toFixed(1) + '%'
}

/** @param {number} covered @param {number} total */
function bar(covered, total) {
  if (total === 0) return '—'
  const p = (covered / total) * 100
  if (p >= 80) return '🟢'
  if (p >= 50) return '🟡'
  return '🔴'
}

const lines = []
lines.push('## 🔬 E2E Coverage')
lines.push('')
lines.push('| Metric | Covered | Total | Pct | |')
lines.push('|---|--:|--:|--:|---|')
lines.push(
  `| Lines | ${coveredLines} | ${totalLines} | ${pct(coveredLines, totalLines)} | ${bar(coveredLines, totalLines)} |`
)
lines.push(
  `| Functions | ${coveredFunctions} | ${totalFunctions} | ${pct(coveredFunctions, totalFunctions)} | ${bar(coveredFunctions, totalFunctions)} |`
)
lines.push(
  `| Branches | ${coveredBranches} | ${totalBranches} | ${pct(coveredBranches, totalBranches)} | ${bar(coveredBranches, totalBranches)} |`
)

const uncovered = [...fileStats.entries()]
  .filter(([, s]) => s.lines > 0)
  .map(([file, s]) => ({
    file: file.replace(/^.*\/src\//, 'src/'),
    pct: s.lines > 0 ? (s.covered / s.lines) * 100 : 100,
    missed: s.lines - s.covered
  }))
  .filter((f) => f.missed > 0)
  .sort((a, b) => b.missed - a.missed)
  .slice(0, 10)

if (uncovered.length > 0) {
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Top 10 files by uncovered lines</summary>')
  lines.push('')
  lines.push('| File | Coverage | Missed |')
  lines.push('|---|--:|--:|')
  for (const f of uncovered) {
    lines.push(`| \`${f.file}\` | ${f.pct.toFixed(1)}% | ${f.missed} |`)
  }
  lines.push('')
  lines.push('</details>')
}

process.stdout.write(lines.join('\n') + '\n')
