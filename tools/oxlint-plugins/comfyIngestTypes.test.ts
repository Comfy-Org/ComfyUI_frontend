import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const pluginPath = path.resolve('tools/oxlint-plugins/comfyIngestTypes.ts')
const oxlintBin = path.resolve('node_modules/.bin/oxlint')

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
      oxlintBin,
      ['--config', path.join(workDir, '.oxlintrc.json'), 'fixture.ts'],
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
