import { matchesModulePath } from './records'
import type { ArchitectureConfiguration } from './records'

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

export function buildCatalog(
  { exceptions, records, sourceFiles }: ArchitectureConfiguration,
  codeowners: CodeownersRule[]
) {
  return {
    domains: records.map((record) => ({
      ...record,
      modules: record.modules.map((module) => ({
        ...module,
        owners: [
          ...new Set(
            sourceFiles
              .filter((file) => matchesModulePath(file, module.path))
              .flatMap((file) => ownersOf(file, codeowners))
          )
        ].sort()
      }))
    })),
    exceptions
  }
}
