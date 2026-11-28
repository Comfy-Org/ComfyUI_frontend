import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ADR_FILE_PATTERN =
  /^([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*(?:-(\d{4}))?-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.md$/
const STATUS_LINE_PATTERN =
  /^(Proposed|Accepted|Rejected|Deprecated|Superseded)(?: \(\d{4}-\d{2}-\d{2}\))?(?: by \[ADR-[A-Za-z0-9-]+\]\([^)\s]+\.md\))?$/
const STATUS_SECTION_PATTERN =
  /^## Status[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m
const CITED_PROPOSALS_AWAITING_OWNER_STATUS = new Set([
  'AUTH-BILLING-billing-attempt-context-and-workspace-scope',
  'AUTH-SESSION-shared-web-session-on-a-host-only-cookie',
  'CRDT-AUTHORITY-human-canvas-authority-and-draft-reconciliation',
  'CRDT-LAYOUT-crdt-layout-intent-and-local-measurement',
  'CRDT-RECONCILE-local-only-state-survives-authoritative-reconcile',
  'CRDT-REPLAY-retain-exhausted-operations-for-same-page-replay',
  'ECS-IDENTITY-entity-id-collision-policy-and-recovery',
  'GRAPH-DOCUMENT-frontend-document-model',
  'GRAPH-DOCUMENT-graph-activation-and-document-objects-for-in-app-agent-targets',
  'PACKAGES-ACCOUNT-UI-payment-ui-belongs-to-the-shared-account-ui-package',
  'PERF-BENCHMARKS-performance-evidence-and-regression-framework',
  'RELEASES-one-label-requests-core-backports'
])
const ADR_CITATION_PATTERN =
  /(?<![A-Za-z0-9-])ADR-(([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)(?:-(\d{4}))?(?:-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?)(?![0-9])/g
const ADR_FILENAME_PATTERN =
  /(?<![A-Za-z0-9-])(([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)(?:-(\d{4}))?-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.md/g
const EXTERNAL_ADR_IDS = new Set(['ORDERING-0005'])
const STALE_REFERENCE_FIXTURE_FILES = new Set([
  'scripts/check-adrs.test.ts',
  'tools/ci/src/cicd/check-adr-links.test.ts'
])
const LEGACY_REFERENCE_PATTERN =
  /ADR(?:[- ]?\d{4}(?!-\d{2})|(?:-[A-Z][A-Z0-9]*)?\s*(?:\/\s*|\(\s*)\d{4}(?!-\d{2}))|(?:docs\/)?adr\/\d{4}-/

type Adr = {
  contents: string
  date: string
  filename: string
  id: string
  name: string
  sequence: string | undefined
  status: string
}

type TextFile = {
  contents: string
  filename: string
}

type StaleReference = {
  lineNumber: number
  reference: string
  replacement: string | undefined
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

export const findStaleAdrReferences = (
  contents: string,
  adrFilenames: string[],
  renames: Record<string, string>
): StaleReference[] => {
  const currentIds = new Set([
    ...adrFilenames.map((filename) => filename.replace(/\.md$/, '')),
    ...adrFilenames.flatMap(
      (filename) => /^([A-Z][A-Z0-9-]*?-\d{4})-[a-z]/.exec(filename)?.[1] ?? []
    ),
    ...EXTERNAL_ADR_IDS
  ])
  const isStale = ([, id, tags]: RegExpMatchArray): boolean =>
    id !== tags && !currentIds.has(id)
  const renamed = ([, , tags, sequence]: RegExpMatchArray):
    | string
    | undefined => sequence && renames[`${tags}-${sequence}`]
  return contents.split('\n').flatMap((line, index) => [
    ...[...line.matchAll(ADR_CITATION_PATTERN)]
      .filter(isStale)
      .map((match) => ({
        lineNumber: index + 1,
        reference: match[0],
        replacement: renamed(match) && `ADR-${renamed(match)}`
      })),
    ...[...line.matchAll(ADR_FILENAME_PATTERN)]
      .filter(([, stem]) => !currentIds.has(stem))
      .map((match) => ({
        lineNumber: index + 1,
        reference: match[0],
        replacement: renamed(match) && `${renamed(match)}.md`
      }))
  ])
}

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
    name: sequence ? id.replace(`-${sequence}-`, '-') : id,
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
    !new RegExp(`^# ADR-${id}: \\S`).test(contents) &&
      `first line must be "# ADR-${id}: Title"`,
    !date && 'missing a valid Date field',
    !status &&
      'Status must be one line, such as "Accepted", "Accepted (2026-01-31)" or "Superseded by [ADR-<identifier>](<identifier>.md)"; move notes to another section',
    contents.includes('<!--') && 'remove the leftover template comment'
  ]
    .filter((problem) => typeof problem === 'string')
    .map((problem) => `${filename}: ${problem}`)

const findNumberingProblems = (adrs: Adr[]): string[] =>
  adrs.flatMap(({ filename, name, sequence }) => {
    const sharing = adrs.filter((other) => other.name === name)
    if (sharing.length === 1 && sequence) {
      return `${filename}: no other ADR is named ${name}; drop the sequence number`
    }
    if (sharing.length > 1 && !sequence) {
      return `${filename}: ${sharing.length} ADRs are named ${name}; give each a sequence number`
    }
    return []
  })

const cites = (contents: string, { filename, id }: Adr): boolean =>
  new RegExp(
    `(?<![A-Za-z0-9-])(?:ADR-${id}(?![A-Za-z0-9]|-[A-Za-z0-9])|${filename.replace('.', '\\.')})`
  ).test(contents)

const findProposedCitations = (adrs: Adr[], guides: TextFile[]): string[] => {
  const settledAwaitingIds = adrs
    .filter(
      ({ id, status }) =>
        CITED_PROPOSALS_AWAITING_OWNER_STATUS.has(id) &&
        status &&
        status !== 'Proposed'
    )
    .map(
      ({ id }) =>
        `ADR-${id} is no longer Proposed; remove it from CITED_PROPOSALS_AWAITING_OWNER_STATUS`
    )
  const proposals = adrs.filter(
    ({ id, status }) =>
      status === 'Proposed' && !CITED_PROPOSALS_AWAITING_OWNER_STATUS.has(id)
  )
  const citingFiles = [
    ...adrs.filter(({ status }) => status === 'Accepted'),
    ...guides.map((guide) => ({ ...guide, id: '' }))
  ]
  const citations = citingFiles.flatMap(({ contents, filename, id }) =>
    proposals
      .filter((proposal) => proposal.id !== id && cites(contents, proposal))
      .map(
        (proposal) =>
          `${filename}: cites ADR-${proposal.id}, which is still Proposed; settle its status first`
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

  for (const companion of entries.filter((entry) => entry.isDirectory())) {
    if (!markdownFiles.includes(`${companion.name}.md`)) {
      errors.push(
        `ADR companion directory has no matching ADR: ${companion.name}`
      )
    }
  }

  errors.push(
    ...findNumberingProblems(adrs),
    ...findProposedCitations(adrs, guides)
  )

  if (errors.length) throw new Error(`ADR check failed:\n${errors.join('\n')}`)
}

const formatLegacyReferences = ({ contents, filename }: TextFile): string[] =>
  findLegacyAdrReferences(contents).map(
    ({ line, lineNumber }) => `${filename}:${lineNumber}:${line.trim()}`
  )

const formatStaleReferences = (
  { contents, filename }: TextFile,
  adrFilenames: string[],
  renames: Record<string, string>
): string[] =>
  STALE_REFERENCE_FIXTURE_FILES.has(filename)
    ? []
    : findStaleAdrReferences(contents, adrFilenames, renames).map(
        ({ lineNumber, reference, replacement }) =>
          `${filename}:${lineNumber}: ${reference} names no current ADR${replacement ? `; use ${replacement}` : ''}`
      )

function* readTextFiles(repositoryRoot: string): Generator<TextFile> {
  const filenames = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: repositoryRoot, encoding: 'utf8' }
  ).split('\0')
  for (const filename of filenames) {
    const path = join(repositoryRoot, filename)
    if (!filename || !existsSync(path)) continue
    const contents = readFileSync(path, 'utf8')
    if (!contents.includes('\0')) yield { contents, filename }
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const repositoryRoot = process.cwd()
  const adrDirectory = join(repositoryRoot, 'docs/adr')
  const adrFilenames = readdirSync(adrDirectory).filter((filename) =>
    filename.endsWith('.md')
  )
  const renames: Record<string, string> = JSON.parse(
    readFileSync(join(repositoryRoot, 'scripts/adr-renames.json'), 'utf8')
  )
  const guides: TextFile[] = []
  const legacyReferences: string[] = []
  const staleReferences: string[] = []
  for (const file of readTextFiles(repositoryRoot)) {
    if (basename(file.filename) === 'AGENTS.md') guides.push(file)
    legacyReferences.push(...formatLegacyReferences(file))
    staleReferences.push(...formatStaleReferences(file, adrFilenames, renames))
  }
  validateAdrDirectory(adrDirectory, guides)
  if (legacyReferences.length) {
    throw new Error(
      `Legacy numbered ADR references found:\n${legacyReferences.join('\n')}`
    )
  }
  if (staleReferences.length) {
    throw new Error(
      `Stale ADR references found:\n${staleReferences.join('\n')}`
    )
  }
  process.stdout.write('ADR validation passed\n')
}
