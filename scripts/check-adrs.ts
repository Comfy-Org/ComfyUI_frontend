import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ADR_FILE_PATTERN =
  /^([A-Z][A-Z0-9]{1,11})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const INDEX_ROW_PATTERN =
  /^\| \[([A-Z][A-Z0-9]{1,11})\]\(([^)]+\.md)\)\s*\| ([^|]+?)\s*\| (Proposed|Accepted|Rejected|Deprecated|Superseded)\s*\| (\d{4}-\d{2}-\d{2}) \|$/
const INDEX_ROW_CANDIDATE_PATTERN = /^\|\s*\[[^\]]+\]\([^)]+\.md\)\s*\|/
const LEGACY_REFERENCE_PATTERN =
  /ADR(?:[- ]?\d{4}(?!-\d{2})|(?:-[A-Z][A-Z0-9]*)?\s*(?:\/\s*|\(\s*)\d{4}(?!-\d{2}))|(?:docs\/)?adr\/\d{4}-/

type Adr = {
  date: string
  filename: string
  id: string
  status: string
  title: string
}

type LegacyReference = {
  line: string
  lineNumber: number
}

export const findLegacyAdrReferences = (contents: string): LegacyReference[] =>
  contents
    .split('\n')
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => LEGACY_REFERENCE_PATTERN.test(line))

const getMetadata = (directory: string, filename: string): Adr => {
  const id = ADR_FILE_PATTERN.exec(filename)?.[1]
  if (!id) throw new Error(`Invalid ADR filename: ${filename}`)

  const contents = readFileSync(join(directory, filename), 'utf8')
  const title = new RegExp(`^# ADR-${id}: (.+)$`, 'm').exec(contents)?.[1]
  const date = /^Date: (\d{4}-\d{2}-\d{2})$/m.exec(contents)?.[1]
  const status =
    /^## Status\s+\n+(?:\s*\n)*?(Proposed|Accepted|Rejected|Deprecated|Superseded)\b/m.exec(
      contents
    )?.[1]

  if (!title)
    throw new Error(`${filename}: expected heading "# ADR-${id}: Title"`)
  if (!date) throw new Error(`${filename}: missing a valid Date field`)
  if (!status) throw new Error(`${filename}: missing a valid Status value`)

  return { date, filename, id, status, title }
}

export const validateAdrDirectory = (directory: string): void => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const markdownFiles = entries
    .filter((entry) => entry.isFile() && entry.name !== 'README.md')
    .map((entry) => entry.name)
  const invalidFiles = markdownFiles.filter(
    (filename) => !ADR_FILE_PATTERN.test(filename)
  )
  if (invalidFiles.length) {
    throw new Error(`Invalid ADR filenames: ${invalidFiles.join(', ')}`)
  }

  const adrs = markdownFiles.map((filename) => getMetadata(directory, filename))
  const ids = adrs.map(({ id }) => id)
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicateIds.length) {
    throw new Error(
      `Duplicate ADR identifiers: ${[...new Set(duplicateIds)].join(', ')}`
    )
  }

  for (const companion of entries.filter((entry) => entry.isDirectory())) {
    if (!markdownFiles.includes(`${companion.name}.md`)) {
      throw new Error(
        `ADR companion directory has no matching ADR: ${companion.name}`
      )
    }
  }

  const indexLines = readFileSync(join(directory, 'README.md'), 'utf8').split(
    '\n'
  )
  const indexRowCandidates = indexLines.filter((line) =>
    INDEX_ROW_CANDIDATE_PATTERN.test(line)
  )
  const invalidIndexRows = indexRowCandidates.filter(
    (line) => !INDEX_ROW_PATTERN.test(line)
  )
  if (invalidIndexRows.length) {
    throw new Error(`Invalid ADR index rows:\n${invalidIndexRows.join('\n')}`)
  }

  const indexRows = indexRowCandidates
    .map((line) => INDEX_ROW_PATTERN.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      date: match[5],
      filename: match[2],
      id: match[1],
      status: match[4],
      title: match[3]
    }))
  const expected = [...adrs].sort((left, right) =>
    left.id.localeCompare(right.id)
  )
  if (JSON.stringify(indexRows) !== JSON.stringify(expected)) {
    throw new Error(
      'ADR index must contain every ADR exactly once, ordered by identifier, with matching title, status, and date'
    )
  }
}

const checkLegacyReferences = (repositoryRoot: string): void => {
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
    .split('\0')
    .filter(Boolean)
  const matches: string[] = []

  for (const filename of files) {
    const absolutePath = join(repositoryRoot, filename)
    if (!existsSync(absolutePath)) continue
    const contents = readFileSync(absolutePath, 'utf8')
    if (contents.includes('\0')) continue

    for (const { line, lineNumber } of findLegacyAdrReferences(contents)) {
      matches.push(`${filename}:${lineNumber}:${line.trim()}`)
    }
  }

  if (matches.length) {
    throw new Error(
      `Legacy numbered ADR references found:\n${matches.join('\n')}`
    )
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const repositoryRoot = process.cwd()
  validateAdrDirectory(join(repositoryRoot, 'docs/adr'))
  checkLegacyReferences(repositoryRoot)
  process.stdout.write('ADR naming and index validation passed\n')
}
