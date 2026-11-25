import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createNodeApiHost, useNodeApiHost } from './nodeApiHost'
import type { VersionHost } from './shared/versionHost'
import { publishedApi } from './v4/__tests__/publishedApi'
import { moduleUrl, TEST_PACK } from './v4/__tests__/testPack'
import { createComfyApi } from './v4/comfyApi'
import { useComfyApiStore } from './v4/comfyApiStore'
import type { Comfy } from './v4/types'

function showOnCanvas(graph: LGraph) {
  const previousCanvas = app.canvasOrUndefined
  onTestFinished(() => {
    Reflect.set(app, 'canvasInternal', previousCanvas)
  })
  app.canvas = fromPartial<LGraphCanvas>({ graph })
}

function laterVersion(graph: LGraph): { comfy: Comfy; version: VersionHost } {
  const { comfy, host } = createComfyApi({ getGraph: () => graph })
  const version: VersionHost = {
    publish: vi.fn(),
    markReady: host.markReady,
    providePacks: host.providePacks,
    endDocument: host.endDocument,
    beginDocument: host.beginDocument,
    beforeHistoryRestore: host.beforeHistoryRestore,
    afterHistoryRestore: host.afterHistoryRestore,
    reapplyTypeColors: host.reapplyTypeColors
  }
  return { comfy, version }
}

describe('the node API host', () => {
  let graph: LGraph
  let current: Comfy
  let later: ReturnType<typeof laterVersion>
  let host: ReturnType<typeof createNodeApiHost>

  beforeEach(() => {
    delete window.comfy_v4
    graph = new LGraph()
    graph.add(new LGraphNode('Kept'))
    showOnCanvas(graph)
    current = publishedApi()
    later = laterVersion(graph)
    host = createNodeApiHost([useComfyApiStore(), later.version])
  })

  it('is what the app drives, over the published version', () => {
    const node = current.graph.nodes()[0]

    useNodeApiHost().beginDocument()

    expect(node.isDeleted).toBe(true)
  })

  it("retires every version's handles when a document begins, and when the host freezes it to load another", () => {
    const begun = [current, later.comfy].map((comfy) => comfy.graph.nodes()[0])
    host.beginDocument()
    const ended = [current, later.comfy].map((comfy) => comfy.graph.nodes()[0])

    host.endDocument(graph)

    expect([...begun, ...ended].map(({ isDeleted }) => isDeleted)).toEqual([
      true,
      true,
      true,
      true
    ])
  })

  it('publishes every version', () => {
    host.publish()

    expect(later.version.publish).toHaveBeenCalledOnce()
    expect(window.comfy_v4).toBe(current)
  })

  it("sets aside every version's handles to a node a restore lacks, and retires them when another node takes its id", () => {
    const versions = [current, later.comfy]
    const nodes = versions.map((comfy) => comfy.graph.nodes()[0])
    const [outgoing] = graph.nodes

    host.beforeHistoryRestore(graph, { id: graph.id, nodes: [] })
    graph.remove(outgoing)
    const newcomer = new LGraphNode('Newcomer')
    newcomer.id = outgoing.id
    graph.add(newcomer)
    const during = nodes.map((node) => node.getTitle())
    host.afterHistoryRestore()

    expect(during).toEqual([undefined, undefined])
    expect(nodes.map(({ isDeleted }) => isDeleted)).toEqual([true, true])
    expect(versions.map((comfy) => comfy.graph.nodes()[0]?.getTitle())).toEqual(
      ['Newcomer', 'Newcomer']
    )
  })

  it('gives every version the packs the backend verified', () => {
    const meta = { url: moduleUrl(TEST_PACK.segment) }

    host.providePacks([{ ...TEST_PACK, version: '2.0.0' }])

    expect(
      [current, later.comfy].map((comfy) => comfy.registerPack(meta).version)
    ).toEqual(['2.0.0', '2.0.0'])
  })

  it.for([
    { call: 'publish', args: [] },
    { call: 'markReady', args: [] },
    { call: 'providePacks', args: [[]] },
    { call: 'endDocument', args: ['graph'] },
    { call: 'beginDocument', args: [] },
    { call: 'beforeHistoryRestore', args: ['graph', { nodes: [] }] },
    { call: 'afterHistoryRestore', args: [] },
    { call: 'reapplyTypeColors', args: [] }
  ] as const)(
    'hands $call to every version, oldest first, with its arguments',
    ({ call, args }) => {
      const heard: [string, unknown[]][] = []
      const spy = (name: string) =>
        fromAny<VersionHost, object>(
          new Proxy(
            {},
            {
              get:
                () =>
                (...given: unknown[]) =>
                  heard.push([name, given])
            }
          )
        )
      const fanned = createNodeApiHost([spy('older'), spy('newer')])

      Reflect.apply(fanned[call], fanned, args)

      expect(heard).toEqual([
        ['older', args],
        ['newer', args]
      ])
    }
  )
})
