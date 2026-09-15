import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { workshopContractSchema } from '../src/config/workshop-contract'
import {
  parseRouterResponse,
  releaseRouterOutputs
} from '../src/config/workshop-response'
import { captureRouterOutputs } from './router-model-evidence'

const contract = workshopContractSchema.parse({
  id: 'fixture/native',
  sourceCommit: 'a'.repeat(40),
  inputSchema: { type: 'object' },
  output: { format: 'auto', contentTypes: ['application/json'] }
})
let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'router-evidence-'))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

describe('parsed Router output evidence', () => {
  it('preserves complete JSON for replay after misclassified outputs are released', async () => {
    const data = {
      data: [{ url: 'https://provider.example/extensionless-output' }],
      detail: 'a'.repeat(70_000)
    }
    const outputs = await parseRouterResponse(contract, Response.json(data))
    try {
      expect(outputs.map(({ kind }) => kind)).toEqual(['other', 'text'])
      expect(outputs[1].truncated).toBe(true)
      await captureRouterOutputs(outputs, directory, '', 100_000)
    } finally {
      releaseRouterOutputs(outputs)
    }
    const saved = await readFile(join(directory, 'response-2.json'), 'utf8')
    expect(JSON.parse(saved)).toEqual(data)
    const replayed = await parseRouterResponse(
      contract,
      new Response(saved, { headers: { 'Content-Type': 'application/json' } })
    )
    try {
      expect(replayed[0]).toEqual(outputs[0])
      expect(
        JSON.parse(await readFile(join(directory, 'outputs.json'), 'utf8'))
      ).toMatchObject([
        { kind: 'other', url: data.data[0].url },
        { kind: 'text', responseFile: 'response-2.json' }
      ])
    } finally {
      releaseRouterOutputs(replayed)
    }
  })

  it('redacts echoed credentials in private files without mutating outputs', async () => {
    const token = 'secret-"router-key'
    const data = {
      [token]: token,
      url: `https://provider.example/output?echo=${encodeURIComponent(token)}`
    }
    const outputs = await parseRouterResponse(contract, Response.json(data))
    const original = JSON.stringify(outputs)
    try {
      await captureRouterOutputs(outputs, directory, token, 100_000)
      for (const name of await readdir(directory)) {
        const path = join(directory, name)
        const text = await readFile(path, 'utf8')
        expect(text).not.toContain(token)
        expect(text).not.toContain(JSON.stringify(token).slice(1, -1))
        expect(text).not.toContain(encodeURIComponent(token))
        expect(text).toContain('[redacted]')
        expect((await stat(path)).mode & 0o777).toBe(0o600)
      }
      expect(JSON.stringify(outputs)).toBe(original)
      await expect(
        captureRouterOutputs(outputs, directory, token, 100_000)
      ).rejects.toThrow('EEXIST')
    } finally {
      releaseRouterOutputs(outputs)
    }
  })

  it('bounds attachments while retaining the parsed-output manifest', async () => {
    const outputs = await parseRouterResponse(
      contract,
      Response.json({ detail: 'a'.repeat(100) })
    )
    try {
      await expect(
        captureRouterOutputs(outputs, directory, '', 50)
      ).rejects.toThrow('Response attachment exceeds byte limit')
      expect(await readdir(directory)).toEqual(['outputs.json'])
    } finally {
      releaseRouterOutputs(outputs)
    }
  })
})
