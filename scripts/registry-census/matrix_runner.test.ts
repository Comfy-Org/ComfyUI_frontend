// @vitest-environment happy-dom
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@comfyorg/litegraph/litegraph'
import { LGraph, LGraphNode, LiteGraph } from '@comfyorg/litegraph/litegraph'

import {
  captureSerializationEntryPoints,
  emittedValuesMatch,
  loadShapeDefs,
  measureFormProof,
  runPack,
  shapeDefsPath
} from './matrix_runner'

const HERE = import.meta.dirname
const FIXTURE = path.join(HERE, 'object_info.fixture.json')

const initialVueNodesMode = LiteGraph.vueNodesMode
const pristineSerialize = LGraphNode.prototype.serialize
const pristineFromStore = LGraphNode.prototype.serializeFromStoreState
const pristineOnAdded = LGraphNode.prototype.onAdded
const outputDirs: string[] = []
const reporter = path.join(import.meta.dirname, 'summarize_form_agreement.py')
let outputDir = ''

afterEach(() => {
  LiteGraph.vueNodesMode = initialVueNodesMode
  LGraphNode.prototype.serialize = pristineSerialize
  LGraphNode.prototype.serializeFromStoreState = pristineFromStore
  LGraphNode.prototype.onAdded = pristineOnAdded
  for (const dir of [...outputDirs, outputDir].filter(Boolean)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  outputDirs.length = 0
  outputDir = ''
})

describe('matrix runner', () => {
  it.for([
    { renderer: 'legacy', matrixVue: '', selectedMode: false },
    { renderer: 'Vue', matrixVue: '1', selectedMode: true }
  ])(
    'records $renderer initialization and post-pack mutation',
    { timeout: 60_000 },
    async ({ matrixVue, selectedMode }) => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', matrixVue)
      vi.stubEnv('MATRIX_OBJECT_INFO', FIXTURE)
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')
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
      ) as {
        loadedOk?: unknown
        vueNodesMode?: unknown
        registryForms?: unknown
      }

      expect(modeDuringLoad).toBe(selectedMode)
      expect(row.loadedOk).toBe(1)
      expect(row.vueNodesMode).toBe(!selectedMode)
      expect(row.registryForms).toBeUndefined()
    }
  )

  it(
    'drives more than eight frontend-registered node types from one pack',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')
      vi.stubEnv('MATRIX_OBJECT_INFO', '')
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')
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
        formProof?: { driven: Record<string, string> }
      }
      const drivenTypes = row.formNodes
        ?.filter((node) => node.src === 'driven')
        .map((node) => node.t)

      expect(Object.keys(row.driveTypes ?? {})).toEqual(nodeTypes)
      expect(row.driveTypesOmitted).toBe(0)
      expect(drivenTypes).toEqual(nodeTypes)
      expect(Object.keys(row.formProof?.driven ?? {})).toEqual(nodeTypes)
      expect(row.formProof?.driven[nodeTypes[11]]).toBe(
        'widgets_not_serialized'
      )
    }
  )

  it(
    'caps one pack at 64 driven types and records the remainder',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')
      vi.stubEnv('MATRIX_OBJECT_INFO', '')
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')
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
        formProof?: { driven: Record<string, string> }
      }

      expect(row.newTypes).toEqual(nodeTypes)
      expect(Object.keys(row.driveTypes ?? {})).toEqual(nodeTypes.slice(0, 64))
      expect(Object.keys(row.formProof?.driven ?? {})).toEqual(
        nodeTypes.slice(0, 64)
      )
      expect(row.driveTypesOmitted).toBe(1)
    }
  )

  it(
    'reports a driven measurement failure instead of a clean conclusion',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')
      vi.stubEnv('MATRIX_OBJECT_INFO', '')
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')
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
    }
  )

  it(
    'keeps a driven node that cannot save in the graph for the serialize op',
    { timeout: 30_000 },
    async () => {
      outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-runner-'))
      vi.stubEnv('MATRIX_OUT', outputDir)
      vi.stubEnv('MATRIX_VUE', '')
      vi.stubEnv('MATRIX_OBJECT_INFO', '')
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')

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
      vi.stubEnv('MATRIX_OBJECT_INFO', '')
      vi.stubEnv('MATRIX_REGISTRY_FORMS', '')
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
  ])('$name', { timeout: 30_000 }, async ({ pack, onSerialize, expected }) => {
    const ksamplers = await run(pack, onSerialize)
    expect(ksamplers).toHaveLength(1)
    expect(ksamplers[0]).toMatchObject({ v: expected, src: 'battery' })
  })
})

interface FormProofRow {
  graph: Record<string, string>
  driven: Record<string, string>
  needsForm: string[]
  err?: string
}

interface SubgraphProbe {
  scenario: string
  verdict?: string
  coreIsLastWriter?: boolean
  widgets?: number
  ifAssumedFinal?: string
  ifAssumedFinalAtHookSite?: string
  wrongOrder?: string[] | null
  finalValues?: unknown
  err?: string
}

interface RegistryFormsRow {
  source: string
  classes: number
  registered: number
  registerErrors: string[]
  histogram: Record<string, number>
  refusals: Record<string, string>
  needsForm: string[]
  byModule: Record<string, [number, number]>
  digest: string
  subgraph: SubgraphProbe[]
  prototypePatched: { serialize: boolean; serializeFromStoreState: boolean }
  hookErrors: string[]
  err?: string
}

interface MatrixRow {
  formProof?: FormProofRow
  registryForms?: RegistryFormsRow
  incomplete?: boolean
}

type MeasuredRow = Required<Pick<MatrixRow, 'formProof' | 'registryForms'>>

async function rowFor(
  name: string,
  install?: () => Promise<void> | void
): Promise<MeasuredRow> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-form-'))
  outputDirs.push(dir)
  vi.stubEnv('MATRIX_OUT', dir)
  vi.stubEnv('MATRIX_OBJECT_INFO', FIXTURE)
  vi.stubEnv('MATRIX_REGISTRY_FORMS', '1')

  await runPack(name, { entry: async () => install?.() }, ['entry'], name)

  const row = JSON.parse(
    fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')
  ) as MatrixRow
  expect(row.incomplete).toBeUndefined()
  const { formProof, registryForms } = row
  if (!formProof || !registryForms) {
    throw new Error(`${name}: row is missing formProof or registryForms`)
  }
  return { formProof, registryForms }
}

function serializingPack(
  name: string,
  serializer: (serialised: ISerialisedNode) => void
) {
  return async () => {
    const { useExtensionService } =
      await import('@/platform/extensions/services/extensionService')
    useExtensionService().registerExtension({
      name: `matrix.test.${name}`,
      beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
        nodeType.prototype.onSerialize = serializer
      }
    })
  }
}

function numericNamePack(
  name: string,
  serializer?: (this: LGraphNode, serialised: ISerialisedNode) => void
) {
  return async () => {
    const { useExtensionService } =
      await import('@/platform/extensions/services/extensionService')
    useExtensionService().registerExtension({
      name: `matrix.test.${name}`,
      beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
        const configure = nodeType.prototype.configure
        nodeType.prototype.configure = function (
          this: LGraphNode,
          info: ISerialisedNode
        ) {
          configure.call(this, info)
          const widgets = this.widgets ?? []
          widgets.forEach((widget, index) => {
            widget.name = String(widgets.length - index)
          })
        }
        if (serializer) nodeType.prototype.onSerialize = serializer
      }
    })
  }
}

function verdictFor(proof: FormProofRow, type: string): string {
  const keys = Object.keys(proof.graph).filter((k) => k.startsWith(`${type}#`))
  expect(keys).toHaveLength(1)
  return proof.graph[keys[0]]
}

function keyFor(proof: FormProofRow, type: string): string {
  const key = Object.keys(proof.graph).find((k) => k.startsWith(`${type}#`))
  if (!key) throw new Error(`no graph node of type ${type}`)
  return key
}

describe('form proof', () => {
  it(
    'proves a node whose values no pack touched, and refuses one with no values',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor('form-clean')
      const proof = formProof

      expect(verdictFor(proof, 'KSampler')).toBe('provable')
      expect(verdictFor(proof, 'VAEDecode')).toBe('widgets_not_serialized')
      expect(proof.needsForm).toEqual([])
    }
  )

  it(
    'refuses a rebuilt array, and still runs the pack hook',
    { timeout: 60_000 },
    async () => {
      const seen: string[] = []

      const { formProof } = await rowFor(
        'form-rebuilt',
        serializingPack('form-rebuilt', function (data) {
          seen.push('rebuilt')
          data.widgets_values = [...(data.widgets_values ?? [])]
        })
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
      expect(seen).toContain('rebuilt')
      expect(formProof.needsForm).toEqual([])
    }
  )
})

describe('form proof, hooks that remove nodes', () => {
  it('reports a node removed by an earlier hook instead of proving it detached', () => {
    const graph = new LGraph()
    const remover = new LGraphNode('remover')
    remover.type = 'MatrixRemover'
    const removed = new LGraphNode('removed')
    removed.type = 'MatrixRemoved'
    graph.add(remover)
    graph.add(removed)
    remover.onSerialize = () => {
      if (graph._nodes.includes(removed)) graph.remove(removed)
    }

    const proof = measureFormProof(
      graph,
      [],
      () => null,
      captureSerializationEntryPoints(LGraphNode)
    )

    expect(proof.graph[`MatrixRemoved#${String(removed.id)}`]).toBe(
      '!removed_by_hook'
    )
    expect(proof.graph[`MatrixRemover#${String(remover.id)}`]).not.toBe(
      '!removed_by_hook'
    )
  })
})

describe('emitted value correspondence', () => {
  const widget = (name: string, value: unknown, serialize = true) => ({
    name,
    value,
    serialize
  })
  const named = (entries: [string, unknown][]) => {
    const record: Record<string, unknown> = {}
    for (const [name, value] of entries) record[name] = value
    return record
  }

  it('accepts integer-like names in non-ascending positional order', () => {
    expect(
      emittedValuesMatch(
        named([
          ['2', 22],
          ['1', 11]
        ]),
        [22, 11],
        [widget('2', 22), widget('1', 11)]
      )
    ).toBe(true)
  })

  it('refuses integer-like names reordered after core wrote the values', () => {
    expect(
      emittedValuesMatch(
        named([
          ['2', 22],
          ['1', 11]
        ]),
        [22, 11],
        [widget('1', 11), widget('2', 22)]
      )
    ).toBe(false)
  })

  it('refuses equal-valued widgets swapped after core wrote the values', () => {
    const equal = named([
      ['a', 0],
      ['b', 0]
    ])
    const swapped = [widget('b', 0), widget('a', 0)]

    expect(emittedValuesMatch(equal, [0, 0], swapped)).toBe(true)
    expect(emittedValuesMatch(equal, [0, 0], swapped, ['a', 'b'])).toBe(false)
  })

  it('refuses a swap of which widgets serialize', () => {
    expect(
      emittedValuesMatch(
        named([['a', 11]]),
        [11],
        [widget('a', 11, false), widget('b', 22)]
      )
    ).toBe(false)
  })

  it('ignores non-serializing widgets and compares object values by content', () => {
    expect(
      emittedValuesMatch(
        named([
          ['b', { x: 1 }],
          ['a', 11]
        ]),
        [{ x: 1 }, 11],
        [widget('c', 0, false), widget('b', { x: 1 }), widget('a', 11)]
      )
    ).toBe(true)
  })
})

describe('form proof, hooks that rewrite in place', () => {
  it(
    'refuses a form when value access changes the serializing widget set',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-value-getter-mutates',
        async () => {
          const { useExtensionService } =
            await import('@/platform/extensions/services/extensionService')
          useExtensionService().registerExtension({
            name: 'matrix.test.form-value-getter-mutates',
            beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
              const configure = nodeType.prototype.configure
              nodeType.prototype.configure = function (
                this: LGraphNode,
                info: ISerialisedNode
              ) {
                configure.call(this, info)
                if (!this.widgets || this.widgets.length < 3) return
                const [disabled, written, mutating] = this.widgets
                disabled.serialize = false
                written.serialize = true
                mutating.serialize = true
                let value = mutating.value
                Object.defineProperty(mutating, 'value', {
                  configurable: true,
                  get() {
                    disabled.serialize = disabled.serialize === false
                    written.serialize = written.serialize === false
                    return value
                  },
                  set(next) {
                    value = next
                  }
                })
              }
            }
          })
        }
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
    }
  )

  it(
    'refuses a hook that reorders the core array in place',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-reversed',
        serializingPack('form-reversed', function (data) {
          data.widgets_values?.reverse()
        })
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
    }
  )

  it(
    'refuses a hook that deletes an entry without changing the length',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-hole',
        serializingPack('form-hole', function (data) {
          if (data.widgets_values) delete data.widgets_values[0]
        })
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
    }
  )

  it(
    'refuses a hook that reorders the widgets in place',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-widgets-reordered',
        serializingPack('form-widgets-reordered', function (this: LGraphNode) {
          this.widgets?.reverse()
        })
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
    }
  )

  it(
    'allows a non-serializing widget to move around enabled widgets',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-disabled-widget-moved',
        serializingPack(
          'form-disabled-widget-moved',
          function (this: LGraphNode) {
            const widgets = this.widgets
            const index = widgets?.findIndex(
              (widget) => widget.name === 'steps'
            )
            if (!widgets || index == null || index < 0) return
            const [disabled] = widgets.splice(index, 1)
            disabled.serialize = false
            if (index === 0) widgets.push(disabled)
            else widgets.unshift(disabled)
          }
        )
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('provable')
    }
  )

  it(
    'proves a form whose widget names are integer-like and out of order',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-numeric-names',
        numericNamePack('form-numeric-names')
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('provable')
    }
  )

  it(
    'refuses a hook that swaps which widgets serialize',
    { timeout: 60_000 },
    async () => {
      const initialized = new WeakSet<LGraphNode>()
      const { formProof } = await rowFor(
        'form-serialize-flags-swapped',
        serializingPack(
          'form-serialize-flags-swapped',
          function (this: LGraphNode) {
            const first = this.widgets?.find(
              (widget) => widget.name === 'steps'
            )
            const second = this.widgets?.find((widget) => widget.name === 'cfg')
            if (!first || !second) return
            if (!initialized.has(this)) {
              initialized.add(this)
              first.serialize = false
              second.serialize = true
              return
            }
            const firstSerializes = first.serialize
            first.serialize = second.serialize
            second.serialize = firstSerializes
          }
        )
      )

      expect(verdictFor(formProof, 'KSampler')).toBe('values_replaced')
    }
  )

  it(
    'measures a class whose onSerialize hook is read-only',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor('form-readonly-hook', async () => {
        const { useExtensionService } =
          await import('@/platform/extensions/services/extensionService')
        useExtensionService().registerExtension({
          name: 'matrix.test.form-readonly-hook',
          beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
            Object.defineProperty(nodeType.prototype, 'onSerialize', {
              value: () => {},
              writable: false,
              configurable: true
            })
          }
        })
      })

      expect(formProof.err).toBeUndefined()
      expect(verdictFor(formProof, 'KSampler')).toBe('provable')
    }
  )

  it(
    'measures a node whose own onSerialize hook is writable but fixed in place',
    { timeout: 60_000 },
    async () => {
      function fixedHook(this: LGraphNode) {
        if (Object.hasOwn(this, 'onSerialize')) return
        Object.defineProperty(this, 'onSerialize', {
          value: fixedHook,
          writable: true,
          configurable: false
        })
      }
      const { formProof } = await rowFor(
        'form-fixed-own-hook',
        serializingPack('form-fixed-own-hook', fixedHook)
      )

      expect(formProof.err).toBeUndefined()
      expect(verdictFor(formProof, 'KSampler')).toBe('provable')
    }
  )

  it(
    'refuses a class whose prototype serialize a pack replaced, even in place',
    { timeout: 60_000 },
    async () => {
      const { formProof, registryForms } = await rowFor(
        'census-patcher-in-place',
        () => {
          const base = LGraphNode.prototype.serialize
          LGraphNode.prototype.serialize = function (this: LGraphNode) {
            const serialised = base.call(this)
            serialised.widgets_values?.reverse()
            return serialised
          }
        }
      )

      expect(verdictFor(formProof, 'KSampler')).toBe(
        'class_may_rewrite_payload'
      )
      expect(registryForms.histogram).toEqual({
        class_may_rewrite_payload: registryForms.classes
      })
    }
  )
})

describe('form proof, temporary nodes', () => {
  it(
    'removes each temporary node even when a pack forbids removal',
    { timeout: 60_000 },
    async () => {
      const temporary: LGraphNode[] = []

      await rowFor('form-unremovable', () => {
        LGraphNode.prototype.onAdded = function () {
          this.ignore_remove = true
          if (this.pos[0] === 1400 && this.pos[1] === 100) temporary.push(this)
        }
      })

      expect(temporary.length).toBeGreaterThan(1)
      expect(temporary.filter((node) => node.graph)).toEqual([])
    }
  )
})

describe('form proof, shapes nothing can describe', () => {
  it(
    'refuses an object-shaped payload and counts it as needing a form',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor(
        'form-object',
        serializingPack('form-object', function (data) {
          Object.assign(data, { widgets_values: { seed: 1 } })
        })
      )
      const proof = formProof

      expect(verdictFor(proof, 'KSampler')).toBe('values_not_positional')
      expect(proof.needsForm).toContain(keyFor(proof, 'KSampler'))
    }
  )

  it(
    'records a pack that cannot serialize at all without losing the row',
    { timeout: 60_000 },
    async () => {
      const { formProof, registryForms } = await rowFor(
        'form-throws',
        serializingPack('form-throws', () => {
          throw new Error('pack serializer exploded')
        })
      )

      expect(new Set(Object.values(formProof.graph))).toEqual(
        new Set(['!serialize_threw'])
      )
      expect(formProof.err).toBeUndefined()
      expect(registryForms.err).toBeUndefined()
    }
  )
})

describe('registry form census', () => {
  it('registers REAL node definitions, not the six battery defs', () => {
    vi.stubEnv('MATRIX_OBJECT_INFO', '')
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<
      string,
      unknown
    >
    const projection = loadShapeDefs()
    expect(Object.keys(projection).length).toBeGreaterThan(3000)
    const projected = Object.fromEntries(
      Object.keys(fixture).map((name) => [name, projection[name]])
    )
    expect(JSON.stringify(projected)).toBe(JSON.stringify(fixture))
  })

  it('fails loudly rather than falling back to six defs', () => {
    vi.stubEnv('MATRIX_OBJECT_INFO', path.join(HERE, 'does-not-exist.json'))
    expect(() => loadShapeDefs()).toThrow(/unreadable/)
    expect(shapeDefsPath()).toContain('does-not-exist.json')
  })

  it(
    'gives every registered class a verdict, and rolls up by pack',
    { timeout: 60_000 },
    async () => {
      const { registryForms } = await rowFor('census-clean')
      const census = registryForms

      expect(census.err).toBeUndefined()
      expect(census.classes).toBe(7)
      expect(census.registered).toBe(7)
      expect(census.registerErrors).toEqual([])
      const verdicts = Object.values(census.histogram).reduce(
        (a, b) => a + b,
        0
      )
      expect(verdicts).toBe(census.classes)
      expect(census.histogram.provable).toBeGreaterThan(0)
      expect(census.refusals.VAEDecode).toBe('widgets_not_serialized')
      const rollups = Object.values(census.byModule)
      expect(rollups.reduce((a, [, n]) => a + n, 0)).toBe(census.classes)
      expect(rollups.reduce((a, [p]) => a + p, 0)).toBe(
        census.histogram.provable
      )
      expect(rollups.length).toBeGreaterThan(1)
      expect(census.digest).toMatch(/^[0-9a-f]{64}$/)
    }
  )

  it(
    'refuses SubgraphNode on the precondition, and shows what assuming it costs',
    { timeout: 60_000 },
    async () => {
      const { registryForms } = await rowFor('census-subgraph')
      const probes = registryForms.subgraph
      expect(probes.map((p) => p.scenario)).toEqual([
        'promoted-only',
        'plus-custom-widget'
      ])

      const refusedButProvableAtHookSite = {
        coreIsLastWriter: false,
        verdict: 'class_may_rewrite_payload',
        ifAssumedFinalAtHookSite: 'provable'
      }
      expect(probes.map((p) => p.err)).toEqual([undefined, undefined])
      expect(probes.map((p) => (p.widgets ?? 0) > 0)).toEqual([true, true])
      expect(probes).toMatchObject([
        refusedButProvableAtHookSite,
        refusedButProvableAtHookSite
      ])

      const [, withExtra] = probes
      expect(withExtra.wrongOrder).toEqual(['text', 'EXTRA'])
      expect(withExtra.finalValues).toHaveLength(1)
    }
  )

  it(
    'records a pack that reassigns the prototype serialization entry point',
    { timeout: 60_000 },
    async () => {
      const { registryForms } = await rowFor('census-patcher', () => {
        const base = LGraphNode.prototype.serialize
        LGraphNode.prototype.serialize = function (this: LGraphNode) {
          const serialised = base.call(this)
          serialised.widgets_values = [...(serialised.widgets_values ?? [])]
          return serialised
        }
      })

      expect(registryForms.prototypePatched.serialize).toBe(true)
      expect(registryForms.histogram).toEqual({
        class_may_rewrite_payload: registryForms.classes
      })
    }
  )
})
