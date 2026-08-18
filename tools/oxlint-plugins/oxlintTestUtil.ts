import { execFileSync } from 'node:child_process'
import path from 'node:path'

const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')

export interface OxlintDiagnostic {
  readonly code: string
  readonly severity: string
  readonly filename: string
  readonly message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOxlintDiagnostic(value: unknown): value is OxlintDiagnostic {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.severity === 'string' &&
    typeof value.filename === 'string' &&
    typeof value.message === 'string'
  )
}

function stdoutFrom(error: unknown): string {
  if (isRecord(error) && typeof error.stdout === 'string') return error.stdout
  throw error
}

function parseDiagnostics(output: string): OxlintDiagnostic[] {
  const report: unknown = JSON.parse(output)
  if (!isRecord(report) || !Array.isArray(report.diagnostics)) {
    throw new Error('Oxlint returned an invalid JSON report')
  }
  const diagnostics: unknown[] = report.diagnostics
  return diagnostics.map((diagnostic) => {
    if (!isOxlintDiagnostic(diagnostic)) {
      throw new Error('Oxlint returned an invalid diagnostic')
    }
    return diagnostic
  })
}

export function runOxlint(args: readonly string[]): OxlintDiagnostic[] {
  let output: string
  try {
    output = execFileSync(process.execPath, [oxlintEntry, ...args], {
      cwd: path.resolve('.'),
      encoding: 'utf8'
    })
  } catch (error) {
    output = stdoutFrom(error)
  }
  return parseDiagnostics(output)
}
