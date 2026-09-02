import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { addWorkflow, deriveWorkflowName, validateWorkflowJson } from './add'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
  tempDirs.length = 0
})

describe('validateWorkflowJson', () => {
  it('rejects invalid JSON', () => {
    expect(validateWorkflowJson('{')).toEqual({
      ok: false,
      reason: 'not valid JSON'
    })
  })

  it('rejects JSON without a nodes array', () => {
    expect(validateWorkflowJson('{"nodes":{}}')).toEqual({
      ok: false,
      reason: 'missing nodes array — is this a ComfyUI workflow export?'
    })
  })

  it('accepts a workflow export', () => {
    expect(validateWorkflowJson('{"nodes":[],"links":[]}')).toEqual({
      ok: true
    })
  })
})

describe('deriveWorkflowName', () => {
  it('slugifies the basename without the JSON extension', () => {
    expect(deriveWorkflowName('/tmp/My Workflow.JSON')).toBe('my-workflow')
  })

  it('prefers and slugifies an explicit name', () => {
    expect(deriveWorkflowName('/tmp/source.json', 'Agent Seed')).toBe(
      'agent-seed'
    )
  })
})

it('refuses to overwrite an existing workflow asset', () => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'comfy-workflow-'))
  tempDirs.push(projectRoot)
  const assetsDir = join(projectRoot, 'browser_tests', 'assets')
  mkdirSync(assetsDir, { recursive: true })
  const sourcePath = join(projectRoot, 'seed.json')
  writeFileSync(sourcePath, '{"nodes":[]}')
  writeFileSync(join(assetsDir, 'seed.json'), '{"nodes":[1]}')

  expect(() => addWorkflow(sourcePath, projectRoot)).toThrow(
    `Workflow already exists at ${join(assetsDir, 'seed.json')}`
  )
})
