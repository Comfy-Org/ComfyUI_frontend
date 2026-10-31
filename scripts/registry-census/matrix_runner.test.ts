// @vitest-environment happy-dom
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { loadShapeDefs, runPack, shapeDefsPath } from './matrix_runner'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const FIXTURE = path.join(HERE, 'object_info.fixture.json')

const initialVueNodesMode = LiteGraph.vueNodesMode
const pristineSerialize = LGraphNode.prototype.serialize
const pristineFromStore = LGraphNode.prototype.serializeFromStoreState
const outputDirs: string[] = []
const reporter = path.join(import.meta.dirname, 'summarize_form_agreement.py')
let outputDir = ''

afterEach(() => {
  LiteGraph.vueNodesMode = initialVueNodesMode
  LGraphNode.prototype.serialize = pristineSerialize
  LGraphNode.prototype.serializeFromStoreState = pristineFromStore
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

  it(
    'drives more than eight frontend-registered node types from one pack',
    { timeout: 30_000 },
    async () => {
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
    }
  )

  it(
    'caps one pack at 64 driven types and records the remainder',
    { timeout: 30_000 },
    async () => {
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
    }
  )

  it(
    'reports a driven measurement failure instead of a clean conclusion',
    { timeout: 30_000 },
    async () => {
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
    }
  )

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

async function rowFor(
  name: string,
  install?: () => Promise<void> | void
): Promise<MatrixRow> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-form-'))
  outputDirs.push(dir)
  vi.stubEnv('MATRIX_OUT', dir)
  vi.stubEnv('MATRIX_OBJECT_INFO', FIXTURE)

  await runPack(name, { entry: async () => install?.() }, ['entry'], name)

  const row = JSON.parse(
    fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')
  ) as MatrixRow
  expect(row.incomplete).toBeUndefined()
  expect(row.formProof).toBeDefined()
  expect(row.registryForms).toBeDefined()
  return row
}

const serializingPack =
  (name: string, serializer: (serialised: ISerialisedNode) => void) =>
  async () => {
    const { useExtensionService } =
      await import('@/platform/extensions/services/extensionService')
    useExtensionService().registerExtension({
      name: `matrix.test.${name}`,
      beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
        nodeType.prototype.onSerialize = serializer
      }
    })
  }

const verdictFor = (proof: FormProofRow, type: string): string => {
  const keys = Object.keys(proof.graph).filter((k) => k.startsWith(`${type}#`))
  expect(keys).toHaveLength(1)
  return proof.graph[keys[0]]
}

const keyFor = (proof: FormProofRow, type: string): string =>
  Object.keys(proof.graph).find((k) => k.startsWith(`${type}#`))!

describe('form proof', () => {
  it(
    'proves a node whose values no pack touched, and refuses one with no values',
    { timeout: 60_000 },
    async () => {
      const { formProof } = await rowFor('form-clean')
      const proof = formProof!

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

      expect(verdictFor(formProof!, 'KSampler')).toBe('values_replaced')
      expect(seen).toContain('rebuilt')
      expect(formProof!.needsForm).toEqual([])
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
      const proof = formProof!

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

      expect(new Set(Object.values(formProof!.graph))).toEqual(
        new Set(['!serialize_threw'])
      )
      expect(formProof!.err).toBeUndefined()
      expect(registryForms!.err).toBeUndefined()
    }
  )
})

describe('registry form census', () => {
  it('registers REAL node definitions, not the six battery defs', () => {
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<
      string,
      unknown
    >
    const projection = loadShapeDefs()
    expect(Object.keys(projection).length).toBeGreaterThan(3000)
    for (const [name, def] of Object.entries(fixture)) {
      expect(projection[name], `${name} is not in the projection`).toBeDefined()
      expect(JSON.stringify(def)).toBe(JSON.stringify(projection[name]))
    }
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
      const census = registryForms!

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
      const probes = registryForms!.subgraph
      expect(probes.map((p) => p.scenario)).toEqual([
        'promoted-only',
        'plus-custom-widget'
      ])

      for (const probe of probes) {
        expect(probe.err).toBeUndefined()
        expect(probe.coreIsLastWriter).toBe(false)
        expect(probe.verdict).toBe('class_may_rewrite_payload')
        expect(probe.widgets).toBeGreaterThan(0)
        expect(probe.ifAssumedFinalAtHookSite).toBe('provable')
      }

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

      expect(registryForms!.prototypePatched.serialize).toBe(true)
      expect(Object.values(registryForms!.histogram)).not.toContain(
        registryForms!.classes
      )
      expect(Object.values(registryForms!.refusals)).toContain(
        'values_replaced'
      )
    }
  )
})
