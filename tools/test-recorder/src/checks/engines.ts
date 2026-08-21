import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

interface Engines {
  node?: string
  pnpm?: string
}

/**
 * Walk up to the repo root. Anchored on package.json rather than
 * playwright.config.ts so this keeps working from inside tools/.
 */
function findRepoRoot(start = process.cwd()): string | undefined {
  let dir = start
  const { root } = parse(dir)
  while (true) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8'))
        if (pkg.engines || pkg.workspaces || pkg.packageManager) return dir
      } catch {
        // Unreadable package.json — keep walking
      }
    }
    if (dir === root) return undefined
    dir = dirname(dir)
  }
}

export function readEngines(): Engines {
  const root = findRepoRoot()
  if (!root) return {}
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    return pkg.engines ?? {}
  } catch {
    return {}
  }
}

/**
 * The version the repo pins via .nvmrc, used for install instructions so we
 * tell people to install the exact version rather than a guess.
 */
export function readNvmrc(): string | undefined {
  const root = findRepoRoot()
  if (!root) return undefined
  try {
    const raw = readFileSync(join(root, '.nvmrc'), 'utf-8').trim()
    return raw || undefined
  } catch {
    return undefined
  }
}

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/, '')
    .split('-')[0]
    .split('.')
    .map((part) => parseInt(part, 10) || 0)
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Minimal semver-range check covering the comparator forms this repo actually
 * uses in engines (">=25 <26", ">=11.3"). Anything we cannot parse is treated
 * as satisfied — a checker that guesses wrong is worse than one that defers.
 */
export function satisfies(version: string, range: string): boolean {
  const actual = parseVersion(version)
  const comparators = range.trim().split(/\s+/).filter(Boolean)
  if (comparators.length === 0) return true

  for (const comparator of comparators) {
    const match = /^(>=|<=|>|<|=)?\s*v?(\d+(?:\.\d+)*)$/.exec(comparator)
    if (!match) return true

    const [, operator = '=', target] = match
    const result = compare(actual, parseVersion(target))
    const ok =
      operator === '>='
        ? result >= 0
        : operator === '<='
          ? result <= 0
          : operator === '>'
            ? result > 0
            : operator === '<'
              ? result < 0
              : result === 0
    if (!ok) return false
  }
  return true
}

/**
 * Human-readable form of a range, for messages aimed at non-developers.
 */
export function describeRange(range: string): string {
  const major = /^>=\s*v?(\d+)/.exec(range.trim())
  const upper = /<\s*v?(\d+)(?:\s|$)/.exec(range)
  if (major && upper) return `v${major[1]}.x`
  if (major) return `v${major[1]} or newer`
  return range
}
