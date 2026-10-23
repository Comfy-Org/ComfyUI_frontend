// @vitest-environment happy-dom
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

/**
 * The form/values channel decides whether a node gets a `widgets_values_form`
 * at all. A node carrying one consults no catalogue on any leg, so a wrong
 * form is authoritative and strictly worse than no form — which makes these
 * two cases the ones worth pinning: a hook that leaves the named projection
 * alone must still yield `emitAgree`, and a hook that substitutes the values
 * must yield no form at all rather than one describing the wrong collection.
 */
describe('form/values agreement channel', () => {
  // `onSerialize` is declared as taking no arguments, but every pack that
  // overwrites values reads the serialised node out of its first parameter -
  // which is the whole reason the form has to be written after the hook.
  type SerializeHook = (data: Record<string, unknown>) => void

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
              const ctor = nodeType as unknown as {
                comfyClass?: string
                prototype: { onSerialize?: SerializeHook }
              }
              if (ctor.comfyClass !== 'KSampler') return
              ctor.prototype.onSerialize = onSerialize
            }
          })
        }
      },
      ['entry'],
      pack
    )
    const row = JSON.parse(
      fs.readFileSync(path.join(outputDir, `${pack}.json`), 'utf8')
    ) as { formNodes?: { t: string; v: string; src: string }[] }
    return (row.formNodes ?? []).filter((n) => n.t === 'KSampler')
  }

  it('reads a hook that leaves the named projection alone as agreeing', async () => {
    // rgthree's shape: values rewritten in place, order untouched.
    const ksamplers = await run('form-inplace', (data) => {
      if (Array.isArray(data.widgets_values))
        data.widgets_values = data.widgets_values.map(() => 0)
    })
    expect(ksamplers).toHaveLength(1)
    expect(ksamplers[0]).toMatchObject({ v: 'emitAgree', src: 'battery' })
  })

  it('records no form when the hook removes the named projection', async () => {
    // The VideoHelperSuite shape: the serialised values become a dict the
    // derived order does not describe, and the named projection goes with it.
    const ksamplers = await run('form-dict', (data) => {
      data.widgets_values = { whatever: 1 }
      delete data.widgets_values_named
    })
    expect(ksamplers).toHaveLength(1)
    expect(ksamplers[0]).toMatchObject({ v: 'noNamed', src: 'battery' })
  })
})
