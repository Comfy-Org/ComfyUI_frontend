import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { collectExportedNames } from './comfyIngestTypes'

const pluginPath = path.resolve('tools/oxlint-plugins/comfyIngestTypes.ts')

// Run Oxlint's Node entrypoint directly; the .bin shim is a .cmd file on Windows
// and cannot be spawned as a bare executable.
const oxlintEntry = path.resolve('node_modules/oxlint/bin/oxlint')

const fixture = `import type { z } from 'zod'

declare const zResubscribeResponse: unknown
declare type components = { schemas: { ErrorResponse: string } }
declare type PreviewSubscribeResponse = { new_plan: string }

interface PendingInvite {
  id: string
}

type SubscriptionDuration = 'MONTHLY' | 'ANNUAL'

type ResubscribeResponse = z.infer<typeof zResubscribeResponse>

type ErrorResponse = components['schemas']['ErrorResponse']

type PreviewPlanInfo = PreviewSubscribeResponse['new_plan']

interface LocalOnlyShape {
  id: string
}

export type {
  PendingInvite,
  SubscriptionDuration,
  ResubscribeResponse,
  ErrorResponse,
  PreviewPlanInfo,
  LocalOnlyShape
}
`

describe('comfy/no-duplicate-ingest-type', () => {
  let workDir: string
  let reportedNames: string[]

  beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'comfy-ingest-types-'))
    writeFileSync(path.join(workDir, 'fixture.ts'), fixture)
    writeFileSync(
      path.join(workDir, '.oxlintrc.json'),
      JSON.stringify({
        jsPlugins: [pluginPath],
        rules: { 'comfy/no-duplicate-ingest-type': 'warn' }
      })
    )

    const stdout = execFileSync(
      process.execPath,
      [
        oxlintEntry,
        '--config',
        path.join(workDir, '.oxlintrc.json'),
        'fixture.ts'
      ],
      { cwd: workDir, encoding: 'utf8' }
    )
    reportedNames = [...stdout.matchAll(/'([^']+)' is already exported/g)].map(
      (match) => match[1]
    )
  })

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('flags an interface whose name duplicates a generated export', () => {
    expect(reportedNames).toContain('PendingInvite')
  })

  it('flags a duplicated string-literal union', () => {
    expect(reportedNames).toContain('SubscriptionDuration')
  })

  it('ignores aliases inferred from a Zod schema', () => {
    expect(reportedNames).not.toContain('ResubscribeResponse')
  })

  it('ignores aliases derived by indexed access from an existing type', () => {
    expect(reportedNames).not.toContain('ErrorResponse')
    expect(reportedNames).not.toContain('PreviewPlanInfo')
  })

  it('ignores names absent from the generated package', () => {
    expect(reportedNames).not.toContain('LocalOnlyShape')
  })
})

describe('collectExportedNames', () => {
  it('collects names across multiple export blocks', () => {
    const names = collectExportedNames(
      `export type { Alpha, Beta } from './a.gen'\n` +
        `export type { Gamma } from './b.gen'\n`
    )
    expect([...names].sort()).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  it('records the alias rather than the original name', () => {
    const names = collectExportedNames(
      `export type { Internal as Public } from './a.gen'`
    )
    expect([...names]).toEqual(['Public'])
  })

  it('tolerates trailing commas and multi-line blocks', () => {
    const names = collectExportedNames(
      `export type {\n  Alpha,\n  Beta,\n} from './a.gen'`
    )
    expect([...names].sort()).toEqual(['Alpha', 'Beta'])
  })

  it('rejects a wildcard re-export rather than skipping it', () => {
    expect(() => collectExportedNames(`export * from './a.gen'`)).toThrow(
      /Unsupported export declaration/
    )
  })

  it('rejects a namespace re-export', () => {
    expect(() =>
      collectExportedNames(`export * as everything from './a.gen'`)
    ).toThrow(/Unsupported export declaration/)
  })

  it('rejects an unreadable declaration even when other exports are complete', () => {
    const readable = Array.from({ length: 150 }, (_, i) => `Name${i}`).join(
      ', '
    )
    expect(() =>
      collectExportedNames(
        `export type { ${readable} } from './types.gen'\n` +
          `export * from './extra.gen'\n`
      )
    ).toThrow(/Unsupported export declaration/)
  })

  it('rejects an unreadable declaration sharing a line with a readable one', () => {
    expect(() =>
      collectExportedNames(
        `export type { Existing } from './a.gen'; export * from './hidden.gen'`
      )
    ).toThrow(/Unsupported export declaration/)
  })

  it('rejects a value export, which would not be a type contract', () => {
    expect(() =>
      collectExportedNames(`export { alpha } from './a.gen'`)
    ).toThrow(/Unsupported export declaration/)
  })

  it('rejects a locally exported declaration', () => {
    expect(() =>
      collectExportedNames(`export interface Alpha { id: string }`)
    ).toThrow(/Unsupported export declaration/)
  })

  it('rejects a local export with no module specifier', () => {
    expect(() => collectExportedNames(`export type { Local }`)).toThrow(
      /Unsupported export declaration/
    )
  })

  it('rejects source that does not parse cleanly', () => {
    expect(() =>
      collectExportedNames(
        `export type { Alpha } from './a.gen'\n` +
          `export type { Broken from './broken.gen'\n`
      )
    ).toThrow(/Unparsable source/)
  })

  it('rejects source with trailing garbage after a valid export', () => {
    expect(() =>
      collectExportedNames(
        `export type { Alpha } from './a.gen'\n` +
          `export type { Gamma } from './c.gen' ???\n`
      )
    ).toThrow(/Unparsable source/)
  })

  it('rejects a UMD namespace export alongside valid exports', () => {
    expect(() =>
      collectExportedNames(
        `export type { Alpha } from './a.gen'\nexport as namespace Hidden\n`
      )
    ).toThrow(/Unsupported export declaration/)
  })

  it('yields no names for empty source, leaving the sufficiency guard to reject it', () => {
    expect(collectExportedNames('').size).toBe(0)
  })

  it('yields no names for an empty named export', () => {
    expect(collectExportedNames(`export type {} from './a.gen'`).size).toBe(0)
  })

  it('ignores the word export inside comments and strings', () => {
    const names = collectExportedNames(
      `// export * from './fake.gen'\n` +
        `export type { Alpha } from './a.gen'\n` +
        `const note = "export * from './also-fake.gen'"\n`
    )
    expect([...names]).toEqual(['Alpha'])
  })
})
