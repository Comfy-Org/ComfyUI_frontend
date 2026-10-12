import { readFile } from 'node:fs/promises'

export interface QualityConfig {
  lint: { eslint: string[]; oxlint?: string[] }
  format: { engine: 'oxfmt' | 'prettier'; args?: string[] }
  audit?: string[]
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function readConfig(file: string): Promise<QualityConfig> {
  const value: unknown = JSON.parse(await readFile(file, 'utf8'))
  if (
    !object(value) ||
    !object(value.lint) ||
    !strings(value.lint.eslint) ||
    value.lint.eslint.length === 0 ||
    (value.lint.oxlint !== undefined && !strings(value.lint.oxlint)) ||
    !object(value.format) ||
    (value.format.engine !== 'oxfmt' && value.format.engine !== 'prettier') ||
    (value.format.args !== undefined && !strings(value.format.args)) ||
    (value.audit !== undefined && !strings(value.audit))
  ) {
    throw new Error(
      `Invalid ${file}: expected lint.eslint arguments and format.engine (oxfmt or prettier)`
    )
  }
  return {
    lint: { eslint: value.lint.eslint, oxlint: value.lint.oxlint },
    format: { engine: value.format.engine, args: value.format.args },
    audit: value.audit
  }
}
