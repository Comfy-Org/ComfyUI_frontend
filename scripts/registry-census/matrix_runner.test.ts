// @vitest-environment happy-dom
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

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

  it('drives more than eight frontend-registered node types from one pack', async () => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
    vi.stubEnv('MATRIX_OUT', outputDir)
    vi.stubEnv('MATRIX_VUE', '')
    const nodeTypes = Array.from(
      { length: 12 },
      (_, index) => `matrix-many-types-${String(index).padStart(2, '0')}`
    )
    await runPack(
      'many-types',
      {
        entry: async () => {
          for (const nodeType of nodeTypes) {
            LiteGraph.registerNodeType(
              nodeType,
              class MatrixManyTypesNode extends LGraphNode {}
            )
          }
        }
      },
      ['entry'],
      'many-types'
    )

    const row = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'many-types.json'), 'utf8')
    ) as {
      driveTypes?: Record<string, string>
      driveTypesOmitted?: number
      formNodes?: Array<{ t: string; src: string }>
    }
    const drivenTypes = row.formNodes
      ?.filter((node) => node.src === 'driven')
      .map((node) => node.t)

    expect(Object.keys(row.driveTypes ?? {})).toEqual(nodeTypes)
    expect(row.driveTypesOmitted).toBe(0)
    expect(drivenTypes).toEqual(nodeTypes)
  })

  it('caps one pack at 64 driven types and records the remainder', async () => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
    vi.stubEnv('MATRIX_OUT', outputDir)
    vi.stubEnv('MATRIX_VUE', '')
    const nodeTypes = Array.from(
      { length: 65 },
      (_, index) => `matrix-capped-types-${String(index).padStart(2, '0')}`
    )
    await runPack(
      'capped-types',
      {
        entry: async () => {
          for (const nodeType of nodeTypes) {
            LiteGraph.registerNodeType(
              nodeType,
              class MatrixCappedTypesNode extends LGraphNode {}
            )
          }
        }
      },
      ['entry'],
      'capped-types'
    )

    const row = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'capped-types.json'), 'utf8')
    ) as {
      newTypes?: string[]
      driveTypes?: Record<string, string>
      driveTypesOmitted?: number
    }

    expect(row.newTypes).toEqual(nodeTypes)
    expect(Object.keys(row.driveTypes ?? {})).toEqual(nodeTypes.slice(0, 64))
    expect(row.driveTypesOmitted).toBe(1)
  })
})

describe('form/values agreement channel', () => {
  type SerializeHook = (data: Record<string, unknown>) => void
  type FormNode = { t: string; v: string; src: string }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  function isFormNode(value: unknown): value is FormNode {
    return (
      isRecord(value) &&
      typeof value.t === 'string' &&
      typeof value.v === 'string' &&
      typeof value.src === 'string'
    )
  }

  const run = async (pack: string, onSerialize: SerializeHook) => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-form-'))
    vi.stubEnv('MATRIX_OUT', outputDir)
    vi.stubEnv('MATRIX_VUE', '')
    await runPack(
      pack,
      {
        entry: async () => {
          const { app } = await import('@/scripts/app')
          app.registerExtension({
            name: `form-test-${pack}`,
            beforeRegisterNodeDef(nodeType) {
              if (Reflect.get(nodeType, 'comfyClass') !== 'KSampler') return
              Reflect.set(nodeType.prototype, 'onSerialize', onSerialize)
            }
          })
        }
      },
      ['entry'],
      pack
    )
    const row: unknown = JSON.parse(
      fs.readFileSync(path.join(outputDir, `${pack}.json`), 'utf8')
    )
    if (!isRecord(row) || !Array.isArray(row.formNodes)) return []
    return row.formNodes.filter(isFormNode).filter((n) => n.t === 'KSampler')
  }

  it.for([
    {
      name: 'agree',
      pack: 'form-inplace',
      onSerialize(data: Record<string, unknown>) {
        if (Array.isArray(data.widgets_values))
          data.widgets_values = data.widgets_values.map(() => 0)
      },
      expected: 'emitAgree'
    },
    {
      name: 'reversed named keys disagree',
      pack: 'form-reversed',
      onSerialize(data: Record<string, unknown>) {
        const named = data.widgets_values_named
        if (isRecord(named))
          data.widgets_values_named = Object.fromEntries(
            Object.entries(named).reverse()
          )
      },
      expected: 'emitDisagree:keyOrder'
    },
    {
      name: 'truncated positional values skew',
      pack: 'form-truncated',
      onSerialize(data: Record<string, unknown>) {
        if (Array.isArray(data.widgets_values))
          data.widgets_values = data.widgets_values.slice(0, -1)
      },
      expected: 'emitAgree:positionalSkew'
    },
    {
      name: 'no named projection',
      pack: 'form-dict',
      onSerialize(data: Record<string, unknown>) {
        data.widgets_values = { whatever: 1 }
        delete data.widgets_values_named
      },
      expected: 'noNamed'
    }
  ])('$name', async ({ pack, onSerialize, expected }) => {
    const ksamplers = await run(pack, onSerialize)
    expect(ksamplers).toHaveLength(1)
    expect(ksamplers[0]).toMatchObject({ v: expected, src: 'battery' })
  })
})
