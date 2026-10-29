// @vitest-environment happy-dom
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode, LiteGraph } from '@comfyorg/litegraph/litegraph'

import { runPack } from './matrix_runner'

const initialVueNodesMode = LiteGraph.vueNodesMode
const reporter = path.join(import.meta.dirname, 'summarize_form_agreement.py')
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

  it('reports a driven measurement failure instead of a clean conclusion', async () => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
    vi.stubEnv('MATRIX_OUT', outputDir)
    vi.stubEnv('MATRIX_VUE', '')
    const nodeType = 'matrix-driven-measurement-failure'

    await runPack(
      'driven-measurement-failure',
      {
        entry: async () => {
          LiteGraph.registerNodeType(
            nodeType,
            class DrivenMeasurementFailureNode extends LGraphNode {
              constructor() {
                super('DrivenMeasurementFailure')
                const widget = this.addWidget('number', 'value', 1, 'value')
                this.onSerialize = (data) => {
                  data.widgets_values_named = { value: 1 }
                  Object.defineProperty(widget, 'name', {
                    configurable: true,
                    get() {
                      throw new Error('driven-measurement-name')
                    }
                  })
                }
              }
            }
          )
        }
      },
      ['entry'],
      'driven-measurement-failure'
    )

    const row: unknown = JSON.parse(
      fs.readFileSync(
        path.join(outputDir, 'driven-measurement-failure.json'),
        'utf8'
      )
    )
    expect(row).toMatchObject({
      formAgreement: {
        harnessError: expect.stringContaining('driven-measurement-name')
      }
    })

    const result = spawnSync('python3', [reporter], {
      encoding: 'utf8',
      env: { ...process.env, MATRIX_OUT: outputDir }
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('recorded a measurement error')
    expect(result.stdout).toContain('driven-measurement-name')
    expect(result.stdout).toContain(
      'measurement errors or unknown verdicts prevent a clean conclusion'
    )
    expect(result.stdout).not.toContain(
      'No disagreeing form in this population'
    )
  })

  it(
    'keeps a driven node that cannot save in the graph for the serialize op',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')

      await runPack(
        'driven-serialize-throw',
        {
          entry: async () => {
            LiteGraph.registerNodeType(
              'matrix-driven-serialize-throw',
              class DrivenSerializeThrowNode extends LGraphNode {
                constructor() {
                  super('DrivenSerializeThrow')
                  this.onSerialize = () => {
                    throw new Error('driven-serialize-throw')
                  }
                }
              }
            )
          }
        },
        ['entry'],
        'driven-serialize-throw'
      )

      const row: unknown = JSON.parse(
        fs.readFileSync(
          path.join(outputDir, 'driven-serialize-throw.json'),
          'utf8'
        )
      )
      expect(row).toMatchObject({
        ops: {
          serialize: { err: expect.stringContaining('driven-serialize-throw') }
        }
      })
    }
  )

  it(
    'measures a disagreeing frontend-only node without a definition',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')
      const nodeType = 'matrix-driven-form-disagreement'

      await runPack(
        'driven-form-disagreement',
        {
          entry: async () => {
            LiteGraph.registerNodeType(
              nodeType,
              class DrivenFormDisagreementNode extends LGraphNode {
                constructor() {
                  super('DrivenFormDisagreement')
                  this.addWidget('number', 'first', 1, 'first')
                  this.addWidget('number', 'second', 2, 'second')
                  this.onSerialize = (data) => {
                    data.widgets_values_named = { second: 2, first: 1 }
                  }
                }
              }
            )
          }
        },
        ['entry'],
        'driven-form-disagreement'
      )

      const row: unknown = JSON.parse(
        fs.readFileSync(
          path.join(outputDir, 'driven-form-disagreement.json'),
          'utf8'
        )
      )
      expect(row).toMatchObject({
        formNodes: expect.arrayContaining([
          expect.objectContaining({
            t: nodeType,
            v: 'emitDisagree:keyOrder',
            src: 'driven'
          })
        ])
      })
    }
  )
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
    },
    {
      name: 'orphan named key is ignored',
      pack: 'form-orphan',
      onSerialize(data: Record<string, unknown>) {
        const named = data.widgets_values_named
        if (isRecord(named))
          data.widgets_values_named = { ...named, orphan: 'ignored' }
      },
      expected: 'emitAgree'
    },
    {
      name: 'a hook that drops a named widget value declines',
      pack: 'form-dropped',
      onSerialize(data: Record<string, unknown>) {
        const named = data.widgets_values_named
        if (isRecord(named)) {
          const [, ...kept] = Object.entries(named)
          data.widgets_values_named = Object.fromEntries(kept)
        }
      },
      expected: 'decline:hook_changed_serialized_widgets'
    }
  ])('$name', async ({ pack, onSerialize, expected }) => {
    const ksamplers = await run(pack, onSerialize)
    expect(ksamplers).toHaveLength(1)
    expect(ksamplers[0]).toMatchObject({ v: expected, src: 'battery' })
  })
})
