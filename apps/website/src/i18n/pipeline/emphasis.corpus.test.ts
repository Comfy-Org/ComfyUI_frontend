import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { emphasisThatCannotClose } from './emphasis'

const CONTENT = join(process.cwd(), 'src', 'content')

function mdxUnder(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) mdxUnder(full, acc)
    else if (entry.endsWith('.mdx')) acc.push(full)
  }
  return acc
}

/**
 * Run over the shipped content, not a fixture.
 *
 * The unit tests prove the rule; this proves the corpus obeys it. Both matter,
 * because the two defects that reached `/ja/pricing` were in files that had
 * already passed every check the pipeline had — a balanced-looking `<strong>`
 * pair is invisible to a structural comparison.
 *
 * Scoped to what this pipeline writes. Five hand-written Chinese files break the
 * same rule and render literal asterisks on comfy.org today: `customers/
 * kathy-smith`, and the `pricing` answers `do-credits-roll-over`,
 * `how-does-team-plan-work`, `team-collaboration-features` and
 * `team-per-seat-pricing`. Fixing them means editing approved human copy, which
 * is a separate, deliberate change rather than something a pipeline PR should
 * do on its way past. Widen this to every locale once they are corrected.
 */
describe('generated Japanese content has no emphasis that cannot close', () => {
  const files = mdxUnder(CONTENT).filter((file) => file.includes('/ja/'))

  it('has content to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it.for(files.map((file) => [file] as const))('%s', ([file]) => {
    expect(emphasisThatCannotClose(readFileSync(file, 'utf8'))).toEqual([])
  })
})
