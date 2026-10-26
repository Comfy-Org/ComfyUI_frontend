// @vitest-environment happy-dom
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

import { runPack } from './matrix_runner'

const initialVueNodesMode = LiteGraph.vueNodesMode
const outputDirs: string[] = []
let outputDir = ''

afterEach(() => {
  LiteGraph.vueNodesMode = initialVueNodesMode
  if (outputDir) outputDirs.push(outputDir)
  outputDir = ''
  while (outputDirs.length)
    fs.rmSync(outputDirs.pop()!, { recursive: true, force: true })
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

interface FormAgreementRow {
  graph: Record<string, string>
  driven: Record<string, string>
  needsForm: string[]
  err?: string
}

/**
 * Run one pack whose only behaviour is the given `onSerialize`, installed the
 * way packs install one, and hand back the form verdicts.
 *
 * `serializer` undefined is the clean control: no pack code touches
 * serialization at all, so the verdicts are the frontend's own.
 */
async function formAgreementFor(
  name: string,
  serializer?: (serialised: ISerialisedNode) => void
): Promise<FormAgreementRow> {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matrix-form-'))
  outputDirs.push(outputDir)
  vi.stubEnv('MATRIX_OUT', outputDir)

  await runPack(
    name,
    {
      entry: async () => {
        if (!serializer) return
        const { useExtensionService } =
          await import('@/services/extensionService')
        useExtensionService().registerExtension({
          name: `matrix.test.${name}`,
          beforeRegisterNodeDef(nodeType: typeof LGraphNode) {
            nodeType.prototype.onSerialize = serializer
          }
        })
      }
    },
    ['entry'],
    name
  )

  const row = JSON.parse(
    fs.readFileSync(path.join(outputDir, `${name}.json`), 'utf8')
  ) as { formAgreement?: FormAgreementRow; incomplete?: boolean }
  // Not a formality: the row starts life as a write-ahead stub, and stub rate
  // is a GATED criterion. A telemetry channel must not be able to cost a row.
  expect(row.incomplete).toBeUndefined()
  expect(row.formAgreement).toBeDefined()
  return row.formAgreement!
}

/** The verdict for the battery's single node of this type. */
const verdictFor = (agreement: FormAgreementRow, type: string): string => {
  const keys = Object.keys(agreement.graph).filter((k) =>
    k.startsWith(`${type}#`)
  )
  expect(keys).toHaveLength(1)
  return agreement.graph[keys[0]]
}

const keyFor = (agreement: FormAgreementRow, type: string): string =>
  Object.keys(agreement.graph).find((k) => k.startsWith(`${type}#`))!

describe('form agreement', () => {
  it(
    'proves a node whose values no pack touched, and refuses one with no values',
    { timeout: 60_000 },
    async () => {
      const agreement = await formAgreementFor('form-clean')

      // KSampler is the node the battery mutates hardest - splice, reorder,
      // convert, and two pushed widgets - and it is still provable, because
      // the proof is about who produced the array, not whether the widget
      // list looks sane. If this ever reads as a refusal the seam has broken,
      // not the ecosystem.
      expect(verdictFor(agreement, 'KSampler')).toBe('provable')
      // VAEDecode has no widgets at all, so no values were written. This is
      // the "nothing to describe" population, not a failure.
      expect(verdictFor(agreement, 'VAEDecode')).toBe('widgets_not_serialized')
      expect(agreement.needsForm).toEqual([])
    }
  )

  it(
    'refuses a rebuilt array, and still runs the pack hook',
    { timeout: 60_000 },
    async () => {
      const seen: string[] = []

      // A pack that copies the array - the single most common shape in the
      // ecosystem, and the one deep equality would wave through. Identity is
      // what catches it.
      const rebuilt = await formAgreementFor('form-rebuilt', function (data) {
        seen.push('rebuilt')
        data.widgets_values = [...(data.widgets_values ?? [])]
      })

      expect(verdictFor(rebuilt, 'KSampler')).toBe('values_replaced')
      // Chained, not clobbered: the capture seam must leave the pack's own
      // serializer in the call path or every row downstream of it is a
      // measurement of the harness.
      expect(seen).toContain('rebuilt')
      expect(rebuilt.needsForm).toEqual([])
    }
  )
})

describe('form agreement, shapes nothing can describe', () => {
  it(
    'refuses an object-shaped payload and counts it as needing a form',
    { timeout: 60_000 },
    async () => {
      const agreement = await formAgreementFor('form-object', function (data) {
        Object.assign(data, { widgets_values: { seed: 1 } })
      })

      // Refused, AND counted as the population a form would rescue, since
      // nothing can address it today.
      expect(verdictFor(agreement, 'KSampler')).toBe('values_not_positional')
      expect(agreement.needsForm).toContain(keyFor(agreement, 'KSampler'))
    }
  )

  it(
    'records a pack that cannot serialize at all without losing the row',
    { timeout: 60_000 },
    async () => {
      const agreement = await formAgreementFor('form-throws', () => {
        throw new Error('pack serializer exploded')
      })

      // Every node refuses, and the row is still complete - formAgreementFor
      // asserts that. A hostile serializer must cost its own verdict and
      // nothing else.
      expect(new Set(Object.values(agreement.graph))).toEqual(
        new Set(['!serialize_threw'])
      )
      expect(agreement.err).toBeUndefined()
    }
  )
})
