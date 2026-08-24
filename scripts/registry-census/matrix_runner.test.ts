import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import { runPack } from './matrix_runner'

const initialVueNodesMode = LiteGraph.vueNodesMode
let outputDir = ''

afterEach(() => {
  LiteGraph.vueNodesMode = initialVueNodesMode
  if (outputDir) fs.rmSync(outputDir, { recursive: true })
})

describe('matrix runner', () => {
  it('records the renderer mode after pack execution', async () => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
    vi.stubEnv('MATRIX_OUT', outputDir)
    vi.stubEnv('MATRIX_VUE', '')

    await runPack(
      'renderer-mutator',
      {
        entry: async () => {
          LiteGraph.vueNodesMode = !LiteGraph.vueNodesMode
        }
      },
      ['entry'],
      'renderer-mutator'
    )

    const row = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'renderer-mutator.json'), 'utf8')
    ) as { loadedOk?: unknown; vueNodesMode?: unknown }

    expect(row.loadedOk).toBe(1)
    expect(row.vueNodesMode).toBe(!initialVueNodesMode)
  }, 30_000)
})
