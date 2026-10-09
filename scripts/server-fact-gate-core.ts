import { z } from 'zod'

export type ChangedRange =
  | { kind: 'added'; start: number; end: number }
  | { kind: 'deleted'; after: number }

export const oxlintReportSchema = z.object({
  diagnostics: z.array(
    z.object({
      message: z.string(),
      filename: z.string(),
      labels: z.array(
        z.object({
          span: z.object({
            offset: z.number(),
            length: z.number(),
            line: z.number()
          })
        })
      )
    })
  )
})

export type OxlintDiagnostic = z.infer<
  typeof oxlintReportSchema
>['diagnostics'][number]

export interface Finding {
  filename: string
  line: number
  message: string
}

const GATED_PATH = /^(?:src|apps\/[^/]+\/src)\/.*\.(?:ts|vue)$/
const UNGATED_PATH =
  /\.(?:test|spec|stories)\.ts$|(?:^|\/)__mocks__\/|(?:^|\/)storybook\//
const NEW_FILE_HEADER = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/

export function isGatedPath(path: string): boolean {
  return GATED_PATH.test(path) && !UNGATED_PATH.test(path)
}

export function changedRanges(diffText: string): Map<string, ChangedRange[]> {
  const ranges = new Map<string, ChangedRange[]>()
  let current: ChangedRange[] | undefined

  for (const line of diffText.split('\n')) {
    const file = NEW_FILE_HEADER.exec(line)
    if (file) {
      current = undefined
      const path = file.at(1)
      if (path !== undefined) {
        current = []
        ranges.set(path, current)
      }
      continue
    }
    const hunk = HUNK_HEADER.exec(line)
    if (!hunk || !current) continue
    const start = Number(hunk[1])
    const count = Number(hunk.at(2) ?? 1)
    current.push(
      count === 0
        ? { kind: 'deleted', after: start }
        : { kind: 'added', start, end: start + count - 1 }
    )
  }
  return ranges
}

// A deletion sits between new lines `after` and `after + 1`. Unwrapping a
// pendingServerFact call deletes lines at the edges of the expression it
// wrapped, so a deletion on either boundary of a finding counts as touching it.
function touches(range: ChangedRange, first: number, last: number): boolean {
  return range.kind === 'added'
    ? first <= range.end && last >= range.start
    : first <= range.after + 1 && last >= range.after
}

export function findingsOnChangedLines(
  diagnostics: readonly OxlintDiagnostic[],
  ranges: readonly ChangedRange[],
  fileText: string
): Finding[] {
  const bytes = Buffer.from(fileText)
  return diagnostics.flatMap(({ filename, message, labels }) => {
    const span = labels.at(0)?.span
    if (!span) return []
    const covered = bytes
      .subarray(span.offset, span.offset + span.length)
      .toString()
    const lastLine = span.line + covered.split('\n').length - 1
    return ranges.some((range) => touches(range, span.line, lastLine))
      ? [{ filename, line: span.line, message }]
      : []
  })
}

export function findingsInFiles(
  rangesByFile: ReadonlyMap<string, readonly ChangedRange[]>,
  diagnostics: readonly OxlintDiagnostic[],
  textOf: (file: string) => string
): Finding[] {
  return [...rangesByFile].flatMap(([file, ranges]) =>
    findingsOnChangedLines(
      diagnostics.filter((diagnostic) => diagnostic.filename === file),
      ranges,
      textOf(file)
    )
  )
}
