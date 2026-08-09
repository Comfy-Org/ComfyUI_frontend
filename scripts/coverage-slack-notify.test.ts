import { describe, expect, it } from 'vitest'

import { parseLcovContent } from './coverage-slack-notify'

function lcov(entries: [file: string, lf: number, lh: number][]): string {
  return entries
    .map(([file, lf, lh]) => `SF:${file}\nLF:${lf}\nLH:${lh}\nend_of_record`)
    .join('\n')
}

function sourceEntries(
  count: number,
  lf: number,
  lh: number
): [string, number, number][] {
  return Array.from({ length: count }, (_, i) => [
    `src/components/Component${i}.vue`,
    lf,
    lh
  ])
}

describe('parseLcovContent', () => {
  it('reports the ratio of covered to total lines', () => {
    const result = parseLcovContent(lcov(sourceEntries(120, 10, 7)))

    expect(result).toEqual({
      percentage: 70,
      totalLines: 1200,
      coveredLines: 840
    })
  })

  it('ignores files outside src/ and packages/', () => {
    const result = parseLcovContent(
      lcov([
        ...sourceEntries(120, 10, 5),
        ['localhost-8188/assets/index-a1b2c3.js', 1000, 1000],
        ['js.stripe.com/dahlia/stripe.js', 500, 500]
      ])
    )

    expect(result?.totalLines).toBe(1200)
    expect(result?.percentage).toBe(50)
  })

  // E2E coverage that fails to map back to source leaves only third-party
  // scripts behind, which are fully covered and would report as 100%.
  it('returns null when too few project files are present', () => {
    expect(
      parseLcovContent(lcov([['js.stripe.com/dahlia/stripe.js', 500, 500]]))
    ).toBeNull()

    expect(parseLcovContent(lcov(sourceEntries(99, 10, 10)))).toBeNull()
    expect(parseLcovContent(lcov(sourceEntries(100, 10, 10)))).not.toBeNull()
  })

  it('returns null for an empty tracefile', () => {
    expect(parseLcovContent('')).toBeNull()
  })
})
