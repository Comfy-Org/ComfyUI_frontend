import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

interface Engines {
  node?: string
  pnpm?: string
}

/** Anchored on package.json so this still works from inside tools/. */
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

export function readEngines(from?: string): Engines {
  const root = findRepoRoot(from)
  if (!root) return {}
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    return pkg.engines ?? {}
  } catch {
    return {}
  }
}

/** The exact version .nvmrc pins, so install steps do not guess. */
export function readNvmrc(from?: string): string | undefined {
  const root = findRepoRoot(from)
  if (!root) return undefined
  try {
    const raw = readFileSync(join(root, '.nvmrc'), 'utf-8').trim()
    return raw || undefined
  } catch {
    return undefined
  }
}

const COMPARATORS: Record<string, (result: number) => boolean> = {
  '>=': (result) => result >= 0,
  '<=': (result) => result <= 0,
  '>': (result) => result > 0,
  '<': (result) => result < 0,
  '=': (result) => result === 0
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
 * Covers the comparator forms engines actually uses. Unparseable ranges are
 * treated as satisfied: guessing wrong is worse than deferring.
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
    if (!COMPARATORS[operator](result)) return false
  }
  return true
}

export function describeRange(range: string): string {
  const lower = /^>=\s*v?(\d+(?:\.\d+)*)/.exec(range.trim())
  if (!lower) return range

  const upperMajor = /<\s*v?(\d+)(?:\.\d+)*(?:\s|$)/.exec(range)
  const [lowerMajor] = lower[1].split('.')
  const pinsWholeMajor =
    upperMajor !== null &&
    lower[1] === lowerMajor &&
    Number(upperMajor[1]) === Number(lowerMajor) + 1

  if (pinsWholeMajor) return `v${lowerMajor}.x`
  if (upperMajor)
    return `v${lower[1]} up to but not including v${upperMajor[1]}`
  return `v${lower[1]} or newer`
}
