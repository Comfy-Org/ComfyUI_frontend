import { randomUUID } from 'node:crypto'
import {
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { z } from 'zod'

const JOURNAL_NAME = '.locale-publication.json'
const TEMP_SUFFIX = '.publication.tmp'

function isSafeRelativePath(file: string): boolean {
  return (
    !file.includes('\\') &&
    !path.posix.isAbsolute(file) &&
    !path.win32.isAbsolute(file) &&
    path.posix.normalize(file) === file &&
    file !== '.' &&
    file !== '..' &&
    !file.startsWith('../') &&
    file !== JOURNAL_NAME &&
    !file.endsWith(TEMP_SUFFIX)
  )
}

const journalSchema = z
  .object({
    version: z.literal(1),
    files: z
      .array(
        z
          .object({
            path: z.string().refine(isSafeRelativePath, {
              message: 'must be a normalized path inside the output directory'
            }),
            old: z.string().nullable(),
            new: z.string().nullable()
          })
          .strict()
      )
      .min(1)
  })
  .strict()
  .superRefine(({ files }, context) => {
    const seen = new Set<string>()
    files.forEach(({ path: file }, index) => {
      if (seen.has(file))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['files', index, 'path'],
          message: `duplicate path ${file}`
        })
      seen.add(file)
    })
  })

type Journal = z.infer<typeof journalSchema>
type JournalEntry = Journal['files'][number]

function journalPath(outputDir: string): string {
  return path.join(outputDir, JOURNAL_NAME)
}

function readOptional(file: string): Buffer | null {
  try {
    return readFileSync(file)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null
    throw error
  }
}

function matches(current: Buffer | null, recorded: string | null): boolean {
  if (current === null || recorded === null) return current === recorded
  return current.equals(Buffer.from(recorded, 'utf8'))
}

function replaceFile(target: string, contents: string | null): void {
  if (contents === null) {
    rmSync(target, { force: true })
    return
  }
  mkdirSync(path.dirname(target), { recursive: true })
  const temp = `${target}${TEMP_SUFFIX}`
  try {
    writeFileSync(temp, contents, { flush: true })
    renameSync(temp, target)
  } finally {
    rmSync(temp, { force: true })
  }
}

function readJournal(outputDir: string): Journal | null {
  const file = journalPath(outputDir)
  const raw = readOptional(file)
  if (raw === null) return null
  const instructions = `Inspect ${file} and the files it lists, restore the intended catalogs from version control, then delete ${file} and rerun generation.`
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.toString('utf8'))
  } catch (error) {
    throw new Error(
      `Locale publication journal ${file} is not valid JSON. ${instructions}`,
      { cause: error }
    )
  }
  const result = journalSchema.safeParse(parsed)
  if (!result.success)
    throw new Error(
      `Locale publication journal ${file} is invalid: ${result.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ')}. ${instructions}`
    )
  return result.data
}

function completeJournal(outputDir: string, journal: Journal): void {
  const files = journal.files.map((entry) => ({
    entry,
    target: path.join(outputDir, entry.path),
    current: readOptional(path.join(outputDir, entry.path))
  }))
  const edited = files.filter(
    ({ entry, current }) =>
      !matches(current, entry.old) && !matches(current, entry.new)
  )
  if (edited.length > 0) {
    const file = journalPath(outputDir)
    throw new Error(
      `Locale publication in ${outputDir} is incomplete and these files changed after it started: ${edited
        .map(({ entry }) => entry.path)
        .join(
          ', '
        )}. No files were written. Restore each listed file to its "old" or "new" contents recorded in ${file}, then rerun generation. To abandon publication, save your edits separately, restore every journal entry including the manifest to its "old" contents, delete ${file}, then reapply your edits.`
    )
  }
  for (const { entry, target, current } of files) {
    if (!matches(current, entry.new)) replaceFile(target, entry.new)
  }
  rmSync(journalPath(outputDir))
}

function createJournal(outputDir: string, journal: Journal): void {
  const file = journalPath(outputDir)
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, `${JSON.stringify(journal, null, 2)}\n`, {
      flag: 'wx',
      flush: true
    })
    linkSync(temp, file)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
      throw new Error(
        `Locale publication already pending in ${outputDir}. Run generation to recover it before publishing again.`,
        { cause: error }
      )
    throw error
  } finally {
    rmSync(temp, { force: true })
  }
}

function toJournalPath(outputDir: string, target: string): string {
  const relative = path.relative(outputDir, target).split(path.sep).join('/')
  if (!path.isAbsolute(target) || !isSafeRelativePath(relative))
    throw new Error(
      `Cannot publish ${target}: catalog paths must be absolute and inside ${outputDir}`
    )
  return relative
}

export function hasPendingPublication(outputDir: string): boolean {
  return existsSync(journalPath(path.resolve(outputDir)))
}

export function recoverPublication(outputDir: string): void {
  const root = path.resolve(outputDir)
  const journal = readJournal(root)
  if (journal !== null) completeJournal(root, journal)
}

export function publishCatalogs(
  outputDir: string,
  updates: ReadonlyMap<string, string | null>,
  inputs: ReadonlyMap<string, string | null>
): number {
  const root = path.resolve(outputDir)
  if (hasPendingPublication(root))
    throw new Error(
      `Locale publication already pending in ${root}. Run generation to recover it before publishing again.`
    )
  for (const [file, original] of inputs) {
    if (!matches(readOptional(file), original))
      throw new Error(
        `${file} changed during translation. No files were published; rerun against the edited catalogs.`
      )
  }
  const entries: JournalEntry[] = []
  const seen = new Set<string>()
  for (const [target, contents] of updates) {
    const relative = toJournalPath(root, target)
    if (seen.has(relative))
      throw new Error(`Cannot publish ${target}: duplicate path ${relative}`)
    seen.add(relative)
    const original = inputs.get(target) ?? null
    if (original === contents) continue
    entries.push({
      path: relative,
      old: original,
      new: contents
    })
  }
  if (entries.length === 0) return 0
  const journal = journalSchema.parse({ version: 1, files: entries })
  mkdirSync(root, { recursive: true })
  createJournal(root, journal)
  completeJournal(root, journal)
  return entries.filter(({ new: contents }) => contents !== null).length
}
