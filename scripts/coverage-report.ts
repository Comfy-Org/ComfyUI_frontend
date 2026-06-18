import { existsSync, readFileSync } from 'node:fs'

interface FileStats {
  lines: number
  covered: number
}

interface UncoveredFile {
  file: string
  pct: number
  missed: number
}

const lcovPath = process.argv[2] || 'coverage/playwright/coverage.lcov'

if (!existsSync(lcovPath)) {
  process.stdout.write(
    '## 🔬 E2E Coverage\n\n> ⚠️ No coverage data found. Check the CI workflow logs.\n'
  )
  process.exit(0)
}

const lcov = readFileSync(lcovPath, 'utf-8')

interface RecordAccum {
  lf: number
  lh: number
  fnf: number
  fnh: number
  brf: number
  brh: number
}

const fileRecords = new Map<string, RecordAccum>()
let currentFile = ''

for (const line of lcov.split('\n')) {
  if (line.startsWith('SF:')) {
    currentFile = line.slice(3)
  } else if (line.startsWith('LF:')) {
    const n = parseInt(line.slice(3), 10) || 0
    const rec = fileRecords.get(currentFile) ?? {
      lf: 0,
      lh: 0,
      fnf: 0,
      fnh: 0,
      brf: 0,
      brh: 0
    }
    rec.lf = n
    fileRecords.set(currentFile, rec)
  } else if (line.startsWith('LH:')) {
    const n = parseInt(line.slice(3), 10) || 0
    const rec = fileRecords.get(currentFile) ?? {
      lf: 0,
      lh: 0,
      fnf: 0,
      fnh: 0,
      brf: 0,
      brh: 0
    }
    rec.lh = n
    fileRecords.set(currentFile, rec)
  } else if (line.startsWith('FNF:')) {
    const n = parseInt(line.slice(4), 10) || 0
    const rec = fileRecords.get(currentFile)
    if (rec) rec.fnf = n
  } else if (line.startsWith('FNH:')) {
    const n = parseInt(line.slice(4), 10) || 0
    const rec = fileRecords.get(currentFile)
    if (rec) rec.fnh = n
  } else if (line.startsWith('BRF:')) {
    const n = parseInt(line.slice(4), 10) || 0
    const rec = fileRecords.get(currentFile)
    if (rec) rec.brf = n
  } else if (line.startsWith('BRH:')) {
    const n = parseInt(line.slice(4), 10) || 0
    const rec = fileRecords.get(currentFile)
    if (rec) rec.brh = n
  }
}

let totalLines = 0
let coveredLines = 0
let totalFunctions = 0
let coveredFunctions = 0
let totalBranches = 0
let coveredBranches = 0
const fileStats = new Map<string, FileStats>()

for (const [file, rec] of fileRecords) {
  totalLines += rec.lf
  coveredLines += rec.lh
  totalFunctions += rec.fnf
  coveredFunctions += rec.fnh
  totalBranches += rec.brf
  coveredBranches += rec.brh
  fileStats.set(file, { lines: rec.lf, covered: rec.lh })
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

const lines: string[] = []
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

const uncovered: UncoveredFile[] = [...fileStats.entries()]
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
