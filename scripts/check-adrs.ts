import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ADR_FILE_PATTERN =
  /^([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-(\d{4}))-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/
const ADR_CITATION_PATTERN =
  /(?:\bADR-)?\b([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d{4})\b/g
const STATUS_LINE_PATTERN =
  /^(Proposed|Accepted|Rejected|Deprecated|Superseded)(?: \(\d{4}-\d{2}-\d{2}\))?(?: by \[ADR-[A-Z0-9-]+\]\([^)\s]+\.md\))?$/
const STATUS_SECTION_PATTERN =
  /^## Status[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m
const LAST_DATE_WITH_SHARED_SEQUENCES = '2026-11-02'
const CITED_PROPOSALS_AWAITING_OWNER_STATUS = new Set([
  'AUTH-BILLING-0014',
  'AUTH-SESSION-0037',
  'CRDT-LAYOUT-0003',
  'CRDT-RECONCILE-0035',
  'ECS-IDENTITY-0016',
  'GRAPH-DOCUMENT-0024',
  'GRAPH-DOCUMENT-0026',
  'PACKAGES-ACCOUNT-UI-0034',
  'PERF-BENCHMARKS-0022'
])
const LEGACY_REFERENCE_PATTERN =
  /ADR(?:[- ]?\d{4}(?!-\d{2})|(?:-[A-Z][A-Z0-9]*)?\s*(?:\/\s*|\(\s*)\d{4}(?!-\d{2}))|(?:docs\/)?adr\/\d{4}-/

type Adr = {
  contents: string
  date: string
  filename: string
  id: string
  sequence: string
  status: string
}

type TextFile = {
  contents: string
  filename: string
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

const readAdr = (directory: string, filename: string): Adr | undefined => {
  const match = ADR_FILE_PATTERN.exec(filename)
  if (!match) return undefined
  const [, id, sequence] = match
  const contents = readFileSync(join(directory, filename), 'utf8')
  const statusSection = STATUS_SECTION_PATTERN.exec(contents)?.[1].trim() ?? ''
  return {
    contents,
    date: /^Date: (\d{4}-\d{2}-\d{2})$/m.exec(contents)?.[1] ?? '',
    filename,
    id,
    sequence,
    status: STATUS_LINE_PATTERN.exec(statusSection)?.[1] ?? ''
  }
}

const findFormatProblems = ({
  contents,
  date,
  filename,
  id,
  status
}: Adr): string[] =>
  [
    !contents.startsWith(`# ADR-${id}: `) &&
      `first line must be "# ADR-${id}: Title"`,
    !date && 'missing a valid Date field',
    !status &&
      'Status must be one line, such as "Accepted", "Accepted (2026-01-31)" or "Superseded by [ADR-X](X-title.md)"; move notes to another section',
    contents.includes('<!--') && 'remove the leftover template comment'
  ]
    .filter((problem) => typeof problem === 'string')
    .map((problem) => `${filename}: ${problem}`)

const findSequenceReuse = (adrs: Adr[]): string[] =>
  adrs
    .filter(
      (adr) =>
        adr.date > LAST_DATE_WITH_SHARED_SEQUENCES &&
        adrs.some((other) => other !== adr && other.sequence === adr.sequence)
    )
    .map(
      ({ filename, sequence }) =>
        `${filename}: sequence number ${sequence} is already used; take the next unused number`
    )

const findProposedCitations = (adrs: Adr[], guides: TextFile[]): string[] => {
  const proposedIds = new Set(
    adrs.filter(({ status }) => status === 'Proposed').map(({ id }) => id)
  )
  const settledAwaitingIds = adrs
    .filter(
      ({ id, status }) =>
        CITED_PROPOSALS_AWAITING_OWNER_STATUS.has(id) && status !== 'Proposed'
    )
    .map(
      ({ id }) =>
        `ADR-${id} is no longer Proposed; remove it from CITED_PROPOSALS_AWAITING_OWNER_STATUS`
    )
  const citingFiles = [
    ...adrs.filter(({ status }) => status === 'Accepted'),
    ...guides.map((guide) => ({ ...guide, id: '' }))
  ]
  const citations = citingFiles.flatMap(({ contents, filename, id }) =>
    [
      ...new Set(
        [...contents.matchAll(ADR_CITATION_PATTERN)].map(([, cited]) => cited)
      )
    ]
      .filter(
        (cited) =>
          cited !== id &&
          proposedIds.has(cited) &&
          !CITED_PROPOSALS_AWAITING_OWNER_STATUS.has(cited)
      )
      .map(
        (cited) =>
          `${filename}: cites ADR-${cited}, which is still Proposed; settle its status first`
      )
  )
  return [...settledAwaitingIds, ...citations]
}

export const validateAdrDirectory = (
  directory: string,
  guides: TextFile[] = []
): void => {
  const entries = readdirSync(directory, { withFileTypes: true })
  const markdownFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  const adrs = markdownFiles.flatMap(
    (filename) => readAdr(directory, filename) ?? []
  )
  const errors = [
    ...markdownFiles
      .filter((filename) => !ADR_FILE_PATTERN.test(filename))
      .map((filename) => `${filename}: invalid ADR filename`),
    ...adrs.flatMap(findFormatProblems)
  ]

  const ids = adrs.map(({ id }) => id)
  const duplicateIds = new Set(
    ids.filter((id, index) => ids.indexOf(id) !== index)
  )
  for (const id of duplicateIds) errors.push(`Duplicate ADR identifier: ${id}`)

  for (const companion of entries.filter((entry) => entry.isDirectory())) {
    if (!markdownFiles.includes(`${companion.name}.md`)) {
      errors.push(
        `ADR companion directory has no matching ADR: ${companion.name}`
      )
    }
  }

  errors.push(
    ...findSequenceReuse(adrs),
    ...findProposedCitations(adrs, guides)
  )

  if (errors.length) throw new Error(`ADR check failed:\n${errors.join('\n')}`)
}

const checkLegacyReferences = (files: TextFile[]): void => {
  const matches = files.flatMap(({ contents, filename }) =>
    findLegacyAdrReferences(contents).map(
      ({ line, lineNumber }) => `${filename}:${lineNumber}:${line.trim()}`
    )
  )

  if (matches.length) {
    throw new Error(
      `Legacy numbered ADR references found:\n${matches.join('\n')}`
    )
  }
}

const readTextFiles = (repositoryRoot: string): TextFile[] =>
  execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  )
    .split('\0')
    .filter(
      (filename) => filename && existsSync(join(repositoryRoot, filename))
    )
    .map((filename) => ({
      contents: readFileSync(join(repositoryRoot, filename), 'utf8'),
      filename
    }))
    .filter(({ contents }) => !contents.includes('\0'))

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const repositoryRoot = process.cwd()
  const files = readTextFiles(repositoryRoot)
  validateAdrDirectory(
    join(repositoryRoot, 'docs/adr'),
    files.filter(({ filename }) => basename(filename) === 'AGENTS.md')
  )
  checkLegacyReferences(files)
  process.stdout.write('ADR validation passed\n')
}
