import { spawnSync } from 'node:child_process'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { noNewErrorThrowExceptions } from './noNewErrorThrow'

interface Diagnostic {
  readonly code: string
  readonly filename: string
  readonly message: string
}

interface PolicyOverride {
  readonly excludeFiles: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function diagnosticsFrom(value: unknown): readonly Diagnostic[] {
  if (!isRecord(value) || !Array.isArray(value.diagnostics)) {
    throw new TypeError('Oxlint returned an invalid JSON report')
  }
  return value.diagnostics.flatMap((diagnostic: unknown) =>
    isRecord(diagnostic) &&
    typeof diagnostic.code === 'string' &&
    typeof diagnostic.filename === 'string' &&
    typeof diagnostic.message === 'string'
      ? [
          {
            code: diagnostic.code,
            filename: diagnostic.filename,
            message: diagnostic.message
          }
        ]
      : []
  )
}

function policyFrom(value: unknown): PolicyOverride {
  if (!isRecord(value) || !Array.isArray(value.overrides)) {
    throw new TypeError('Oxlint config has no overrides')
  }
  for (const override of value.overrides) {
    if (!isRecord(override) || !isRecord(override.rules)) continue
    if (override.rules['comfy/no-new-error-throw'] !== 'error') continue
    if (!Array.isArray(override.excludeFiles)) {
      throw new TypeError('No-new-error policy has no exclusions')
    }
    const excludeFiles = override.excludeFiles.filter(
      (entry): entry is string => typeof entry === 'string'
    )
    if (excludeFiles.length !== override.excludeFiles.length) {
      throw new TypeError('No-new-error policy has an invalid exclusion')
    }
    return { excludeFiles }
  }
  throw new TypeError('Oxlint config does not enable no-new-error policy')
}

function parseJsonFile(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8'))
}

function fingerprintTotals(value: unknown): ReadonlyMap<string, number> {
  if (!isRecord(value)) throw new TypeError('Invalid no-new-error baseline')

  const totals = new Map<string, number>()
  for (const fingerprints of Object.values(value)) {
    if (!isRecord(fingerprints)) {
      throw new TypeError('Invalid no-new-error baseline entry')
    }
    for (const [fingerprint, count] of Object.entries(fingerprints)) {
      if (!Number.isInteger(count) || Number(count) < 1) {
        throw new TypeError('Invalid no-new-error baseline count')
      }
      totals.set(fingerprint, (totals.get(fingerprint) ?? 0) + Number(count))
    }
  }
  return totals
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function collect(
  root: string,
  policy: PolicyOverride
): Record<string, Record<string, number>> {
  const configPath = path.join(
    root,
    `.no-new-error-throw-collector-${process.pid}.json`
  )
  const pluginPath = path.join(root, 'tools/oxlint-plugins/comfy.ts')
  const oxlintEntry = path.join(root, 'node_modules/oxlint/bin/oxlint')
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        ignorePatterns: policy.excludeFiles,
        jsPlugins: [pluginPath],
        rules: { 'comfy/collect-no-new-error-throw': 'error' }
      },
      null,
      2
    )}\n`
  )

  let stdout: string
  try {
    const result = spawnSync(
      process.execPath,
      [oxlintEntry, '--format=json', '--config', configPath, 'src'],
      { cwd: root, encoding: 'utf8' }
    )
    if (result.error) throw result.error
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(result.stderr || `Oxlint exited ${result.status}`)
    }
    stdout = result.stdout
  } finally {
    unlinkSync(configPath)
  }

  const baseline: Record<string, Record<string, number>> = {}
  for (const diagnostic of diagnosticsFrom(JSON.parse(stdout))) {
    if (diagnostic.code !== 'comfy(collect-no-new-error-throw)') continue
    const file = path
      .relative(root, diagnostic.filename)
      .replaceAll(path.sep, '/')
    const fingerprints = (baseline[file] ??= {})
    fingerprints[diagnostic.message] =
      (fingerprints[diagnostic.message] ?? 0) + 1
  }

  for (const exception of noNewErrorThrowExceptions) {
    const fingerprints = baseline[exception.file]
    const count = fingerprints?.[exception.expression] ?? 0
    if (count < exception.count) {
      throw new Error(
        `Approved exception is stale: ${exception.file}: ${exception.expression}`
      )
    }
    const remaining = count - exception.count
    if (remaining === 0) delete fingerprints[exception.expression]
    else fingerprints[exception.expression] = remaining
    if (Object.keys(fingerprints).length === 0) delete baseline[exception.file]
  }

  return Object.fromEntries(
    Object.entries(baseline)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([file, fingerprints]) => [
        file,
        Object.fromEntries(
          Object.entries(fingerprints).sort(([left], [right]) =>
            compareStrings(left, right)
          )
        )
      ])
  )
}

const root = path.resolve(import.meta.dirname, '../..')
const baselinePath = path.join(
  root,
  'tools/oxlint-plugins/noNewErrorThrowBaseline.json'
)
const policy = policyFrom(parseJsonFile(path.join(root, '.oxlintrc.json')))
const collected = collect(root, policy)
const output = `${JSON.stringify(collected, null, 2)}\n`
const count = Object.values(collected).reduce(
  (total, fingerprints) =>
    total +
    Object.values(fingerprints).reduce(
      (fileTotal, value) => fileTotal + Number(value),
      0
    ),
  0
)
const files = Object.keys(collected).length

if (process.argv.includes('--write')) {
  const previousTotals = fingerprintTotals(parseJsonFile(baselinePath))
  const increased = [...fingerprintTotals(collected)].filter(
    ([fingerprint, nextCount]) =>
      nextCount > (previousTotals.get(fingerprint) ?? 0)
  )
  if (increased.length > 0) {
    throw new Error(
      `Refusing to baseline new fingerprints. Use an approved exception for a reviewed fail-closed contract:\n${increased.map(([fingerprint]) => fingerprint).join('\n')}`
    )
  }
  writeFileSync(baselinePath, output)
  process.stdout.write(`Wrote ${count} expressions across ${files} files.\n`)
} else if (readFileSync(baselinePath, 'utf8') !== output) {
  process.stderr.write(
    'The no-new-error baseline is stale. Run `pnpm no-new-error-baseline:update`.\n'
  )
  process.exitCode = 1
} else {
  process.stdout.write(
    `No-new-error baseline is current: ${count} expressions across ${files} files.\n`
  )
}
