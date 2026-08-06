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

  it('throws on a specifier it cannot interpret', () => {
    expect(() =>
      collectExportedNames(`export type { Alpha, 'weird-name' } from './a.gen'`)
    ).toThrow(/Unrecognized export specifier/)
  })

  it('yields nothing when the barrel uses a form it does not understand', () => {
    expect(collectExportedNames(`export * from './a.gen'`).size).toBe(0)
  })
})
