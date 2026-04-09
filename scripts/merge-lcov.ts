import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface FileRecord {
  lines: Map<number, number>
  functions: Map<string, { name: string; line: number; hits: number }>
  branches: Map<
    string,
    { line: number; block: number; branch: number; hits: number }
  >
}

function getOrCreateRecord(
  files: Map<string, FileRecord>,
  sf: string
): FileRecord {
  let rec = files.get(sf)
  if (!rec) {
    rec = {
      lines: new Map(),
      functions: new Map(),
      branches: new Map()
    }
    files.set(sf, rec)
  }
  return rec
}

function parseLcovFiles(paths: string[]): Map<string, FileRecord> {
  const files = new Map<string, FileRecord>()
  let current: FileRecord | null = null

  for (const filePath of paths) {
    if (!existsSync(filePath)) continue
    const content = readFileSync(filePath, 'utf-8')

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('SF:')) {
        current = getOrCreateRecord(files, trimmed.slice(3))
      } else if (trimmed === 'end_of_record') {
        current = null
      } else if (current) {
        if (trimmed.startsWith('DA:')) {
          const parts = trimmed.slice(3).split(',')
          const lineNum = parseInt(parts[0], 10)
          const hits = parseInt(parts[1], 10) || 0
          const prev = current.lines.get(lineNum) ?? 0
          current.lines.set(lineNum, Math.max(prev, hits))
        } else if (trimmed.startsWith('FN:')) {
          const parts = trimmed.slice(3).split(',')
          const fnLine = parseInt(parts[0], 10)
          const fnName = parts.slice(1).join(',')
          if (!current.functions.has(fnName)) {
            current.functions.set(fnName, {
              name: fnName,
              line: fnLine,
              hits: 0
            })
          }
        } else if (trimmed.startsWith('FNDA:')) {
          const parts = trimmed.slice(5).split(',')
          const hits = parseInt(parts[0], 10) || 0
          const fnName = parts.slice(1).join(',')
          const fn = current.functions.get(fnName)
          if (fn) {
            fn.hits = Math.max(fn.hits, hits)
          } else {
            current.functions.set(fnName, { name: fnName, line: 0, hits })
          }
        } else if (trimmed.startsWith('BRDA:')) {
          const parts = trimmed.slice(5).split(',')
          const brLine = parseInt(parts[0], 10)
          const block = parseInt(parts[1], 10)
          const branch = parseInt(parts[2], 10)
          const hits = parts[3] === '-' ? 0 : parseInt(parts[3], 10) || 0
          const key = `${brLine},${block},${branch}`
          const prev = current.branches.get(key)
          if (prev) {
            prev.hits = Math.max(prev.hits, hits)
          } else {
            current.branches.set(key, {
              line: brLine,
              block,
              branch,
              hits
            })
          }
        }
      }
    }
  }

  return files
}

function writeLcov(files: Map<string, FileRecord>): string {
  const out: string[] = []

  for (const [sf, rec] of [...files.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    out.push(`SF:${sf}`)

    for (const fn of rec.functions.values()) {
      out.push(`FN:${fn.line},${fn.name}`)
    }
    const fnTotal = rec.functions.size
    let fnHit = 0
    for (const fn of rec.functions.values()) {
      out.push(`FNDA:${fn.hits},${fn.name}`)
      if (fn.hits > 0) fnHit++
    }
    out.push(`FNF:${fnTotal}`)
    out.push(`FNH:${fnHit}`)

    for (const br of rec.branches.values()) {
      out.push(
        `BRDA:${br.line},${br.block},${br.branch},${br.hits === 0 ? '-' : br.hits}`
      )
    }
    const brTotal = rec.branches.size
    let brHit = 0
    for (const br of rec.branches.values()) {
      if (br.hits > 0) brHit++
    }
    out.push(`BRF:${brTotal}`)
    out.push(`BRH:${brHit}`)

    for (const [lineNum, hits] of [...rec.lines.entries()].sort(
      (a, b) => a[0] - b[0]
    )) {
      out.push(`DA:${lineNum},${hits}`)
    }
    const lf = rec.lines.size
    let lh = 0
    for (const hits of rec.lines.values()) {
      if (hits > 0) lh++
    }
    out.push(`LF:${lf}`)
    out.push(`LH:${lh}`)

    out.push('end_of_record')
  }

  return out.join('\n') + '\n'
}

function main() {
  const inputDir = process.argv[2]
  const outputFile = process.argv[3]

  if (!inputDir || !outputFile) {
    console.error('Usage: merge-lcov.ts <input-dir> <output-file>')
    console.error(
      '  Finds all coverage.lcov files under <input-dir> and merges them.'
    )
    process.exit(1)
  }

  const findResult = execSync(
    `find ${JSON.stringify(resolve(inputDir))} -name 'coverage.lcov' -type f`,
    { encoding: 'utf-8' }
  ).trim()

  if (!findResult) {
    console.error('No coverage.lcov files found under', inputDir)
    writeFileSync(outputFile, '')
    process.exit(0)
  }

  const lcovFiles = findResult.split('\n').filter(Boolean)
  console.error(`Merging ${lcovFiles.length} shard LCOV files...`)

  const merged = parseLcovFiles(lcovFiles)
  const output = writeLcov(merged)

  writeFileSync(outputFile, output)

  let totalFiles = 0
  let totalLines = 0
  let coveredLines = 0
  for (const rec of merged.values()) {
    totalFiles++
    totalLines += rec.lines.size
    for (const hits of rec.lines.values()) {
      if (hits > 0) coveredLines++
    }
  }
  console.error(
    `Merged: ${totalFiles} source files, ${coveredLines}/${totalLines} lines covered`
  )
}

main()
