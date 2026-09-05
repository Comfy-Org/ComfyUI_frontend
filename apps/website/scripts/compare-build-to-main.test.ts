import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = join(import.meta.dirname, 'compare-build-to-main.sh')
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'workshop-compare-test-'))
  await Promise.all(['base', 'candidate'].map((name) => mkdir(join(dir, name))))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function pages(base: string, candidate: string) {
  await writeFile(join(dir, 'base/index.html'), base)
  await writeFile(join(dir, 'candidate/index.html'), candidate)
}

function compare() {
  return execFileSync('bash', [script, 'base', 'candidate'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe'
  })
}

describe('build comparison', () => {
  it('accepts relative directories and ignores only known build noise', async () => {
    await pages(
      '<script src="/_website/app.abcdef.js"></script><astro-island uid="abc" server-render-time="1.5"></astro-island>',
      '<script src="/_website/app.ghijkl.js"></script><astro-island uid="def" server-render-time="2.5"></astro-island>'
    )
    expect(compare()).toContain('existing changed     0')
  })

  it.for([
    [
      '<link href="/_website/app.abcdef.css">',
      '<link href="/_website/app.ghijkl.js">'
    ],
    [
      '<time>2026-09-04T20:01:55.880Z</time>',
      '<time>2026-09-05T20:01:55.880Z</time>'
    ],
    ['<div uid="first">old</div>', '<div uid="second">old</div>'],
    ['<p>old</p>', '<p>new</p>']
  ])('rejects meaningful differences: %s', async ([base, candidate]) => {
    await pages(base, candidate)
    expect(compare).toThrow()
  })

  it('rejects missing directories and empty builds', () => {
    expect(compare).toThrow()
    expect(() =>
      execFileSync('bash', [script, 'missing', 'candidate'], {
        cwd: dir,
        stdio: 'pipe'
      })
    ).toThrow()
  })

  it('rejects removal of an existing page', async () => {
    await pages('same', 'same')
    await writeFile(join(dir, 'base/removed.html'), 'removed')
    expect(compare).toThrow()
  })
})
