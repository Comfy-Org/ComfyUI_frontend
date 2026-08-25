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
  outputDir = ''
})

describe('matrix runner', () => {
  it.for([
    { renderer: 'legacy', matrixVue: '', selectedMode: false },
    { renderer: 'Vue', matrixVue: '1', selectedMode: true }
  ])(
    'records $renderer initialization and post-pack mutation',
    { timeout: 30_000 },
    async ({ matrixVue, selectedMode }) => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', matrixVue)
      LiteGraph.vueNodesMode = !selectedMode
      let modeDuringLoad: boolean | undefined

      await runPack(
        'renderer-mutator',
        {
          entry: async () => {
            modeDuringLoad = LiteGraph.vueNodesMode
            LiteGraph.vueNodesMode = !LiteGraph.vueNodesMode
          }
        },
        ['entry'],
        'renderer-mutator'
      )

      const row = JSON.parse(
        fs.readFileSync(path.join(outputDir, 'renderer-mutator.json'), 'utf8')
      ) as { loadedOk?: unknown; vueNodesMode?: unknown }

      expect(modeDuringLoad).toBe(selectedMode)
      expect(row.loadedOk).toBe(1)
      expect(row.vueNodesMode).toBe(!selectedMode)
    }
  )
})
