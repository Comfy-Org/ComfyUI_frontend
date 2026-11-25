import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { categorizeBundle } from './bundle-categories'
import type { BundleSize } from './bundle-size'
import { buildBundleReport, renderReport } from './size-report'

describe('categorizeBundle', () => {
  it.for([
    ['assets/index-Ab12Cd.js', 'App Entry Points'],
    ['assets/GraphView-BnV6iF9h.js', 'Graph Workspace'],
    ['assets/useSettingStore-x1.js', 'Data & Services'],
    ['assets/useFoo-x1.js', 'Utilities & Hooks'],
    ['assets/three-x1.js', 'Vendor & Third-Party'],
    ['assets/zzz-x1.js', 'Other']
  ] as const)('%s → %s', ([fileName, category]) => {
    expect(categorizeBundle(fileName)).toBe(category)
  })
})

describe('size report', () => {
  const dirs: string[] = []

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    dirs.length = 0
  })

  function writeBundles(bundles: BundleSize[]): string {
    const dir = mkdtempSync(join(tmpdir(), 'size-report-'))
    dirs.push(dir)
    mkdirSync(dir, { recursive: true })
    for (const bundle of bundles) {
      const name = bundle.file.replace(/[/\\]/g, '_').replace('.js', '.json')
      writeFileSync(join(dir, name), JSON.stringify(bundle))
    }
    return dir
  }

  function bundle(file: string, size: number): BundleSize {
    return {
      file,
      category: categorizeBundle(file),
      size,
      gzip: Math.round(size / 2),
      brotli: Math.round(size / 3)
    }
  }

  it('classifies bundles against the baseline and hides unchanged rows', async () => {
    const curr = writeBundles([
      bundle('assets/index-a.js', 1000),
      bundle('assets/GraphView-a.js', 3000),
      bundle('assets/SettingsPanel-a.js', 500)
    ])
    const prev = writeBundles([
      bundle('assets/index-a.js', 1000),
      bundle('assets/GraphView-a.js', 2000),
      bundle('assets/useFoo-a.js', 400)
    ])

    const report = await buildBundleReport(curr, prev)

    expect(report.hasBaseline).toBe(true)
    expect(report.overall.counts).toEqual({
      added: 1,
      removed: 1,
      increased: 1,
      decreased: 0,
      unchanged: 1
    })
    expect(report.overall.metrics.diff.size).toBe(3000 + 500 - 2000 - 400)
    expect(report.categories.map((c) => c.name)).toEqual([
      'App Entry Points',
      'Graph Workspace',
      'Panels & Settings',
      'Utilities & Hooks'
    ])

    const markdown = renderReport(report)
    expect(markdown).toContain('**assets/SettingsPanel-a.js** _(new)_')
    expect(markdown).toContain('~~assets/useFoo-a.js~~ _(removed)_')
    expect(markdown).not.toMatch(/\| assets\/index-a\.js/)
    expect(markdown).toContain('1 unchanged')
  })

  it('reports current sizes only when no baseline directory exists', async () => {
    const curr = writeBundles([bundle('assets/index-a.js', 1000)])

    const report = await buildBundleReport(curr, join(curr, 'missing'))
    const markdown = renderReport(report)

    expect(report.hasBaseline).toBe(false)
    expect(report.overall.counts.added).toBe(1)
    expect(markdown).toMatch(/\| File\s+\| Size\s+\| Gzip\s+\| Brotli\s+\|/)
    expect(markdown).toContain('Baseline artifact not found')
  })

  it('rejects a malformed size artifact instead of reporting garbage', async () => {
    const curr = writeBundles([])
    writeFileSync(join(curr, 'broken.json'), '{"file":"assets/x.js"}')

    await expect(
      buildBundleReport(curr, join(curr, 'missing'))
    ).rejects.toThrow()
  })
})
