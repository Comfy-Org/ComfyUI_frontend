import type { ArchitectureConfiguration } from './records'
import type { DomainRecord } from './schema'

interface CodeownersRule {
  pattern: string
  owners: string[]
}

export function parseCodeowners(contents: string): CodeownersRule[] {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/)
      return { pattern: pattern.replace(/^\//, ''), owners }
    })
}

function ownersOf(filename: string, rules: CodeownersRule[]): string[] {
  return (
    rules.findLast(({ pattern }) =>
      pattern.endsWith('/')
        ? filename.startsWith(pattern)
        : filename === pattern
    )?.owners ?? []
  )
}

type ImportEdge = readonly [from: string, to: string]

/** Reads the file-to-file imports from Fallow's Graphviz DOT module graph. */
export function importEdges(dot: string): ImportEdge[] {
  const labels = new Map(
    [...dot.matchAll(/^\s*(n\d+) \[label="([^"]+)"/gm)].map(([, id, label]) => [
      id,
      label
    ])
  )
  return [...dot.matchAll(/^\s*(n\d+) -> (n\d+);/gm)].flatMap(
    ([, from, to]) => {
      const fromFile = labels.get(from)
      const toFile = labels.get(to)
      return fromFile && toFile ? [[fromFile, toFile] as const] : []
    }
  )
}

function observedDependencies(
  record: DomainRecord,
  claims: ArchitectureConfiguration['claims'],
  imports: ImportEdge[]
) {
  const counts = new Map<string, number>()
  for (const [from, to] of imports) {
    const target = claims.get(to)?.record
    if (claims.get(from)?.record !== record || !target || target === record)
      continue
    counts.set(target.id, (counts.get(target.id) ?? 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domain, imports]) => ({ domain, imports }))
}

export function buildCatalog(
  {
    claims,
    exceptions,
    records,
    sourceFiles,
    unclassifiedFiles
  }: ArchitectureConfiguration,
  codeowners: CodeownersRule[],
  imports: ImportEdge[]
) {
  const claimed = [...claims]
  return {
    domains: records.map((record) => ({
      ...record,
      sourceFileCount: claimed.filter(([, claim]) => claim.record === record)
        .length,
      dependencies: observedDependencies(record, claims, imports),
      modules: record.modules.map((module) => ({
        ...module,
        owners: [
          ...new Set(
            claimed
              .filter(([, claim]) => claim.module === module)
              .flatMap(([file]) => ownersOf(file, codeowners))
          )
        ].sort()
      }))
    })),
    exceptions,
    coverage: {
      total: sourceFiles.length,
      classified: sourceFiles.length - unclassifiedFiles.length,
      unclassified: unclassifiedFiles.length,
      unclassifiedFiles
    }
  }
}
