import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

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
  const published: string[] = []
  const version: VersionHost = {
    publish: () => published.push('later'),
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

  it("sets aside every version's handles to a node a restore lacks, and retires them when another node has its id after", () => {
    const versions = [current, later.comfy]
    const nodes = versions.map((comfy) => comfy.graph.nodes()[0])

    host.beforeHistoryRestore({ id: graph.id, nodes: [] })
    const during = nodes.map((node) => node.getTitle())
    host.afterHistoryRestore()

    expect(during).toEqual([undefined, undefined])
    expect(nodes.map(({ isDeleted }) => isDeleted)).toEqual([true, true])
    expect(
      versions.map((comfy, index) => comfy.graph.nodes()[0] === nodes[index])
    ).toEqual([false, false])
  })

  it('gives every version the packs the backend verified', () => {
    const meta = { url: moduleUrl(TEST_PACK.segment) }

    host.providePacks([{ ...TEST_PACK, version: '2.0.0' }])

    expect(
      [current, later.comfy].map((comfy) => comfy.registerPack(meta).version)
    ).toEqual(['2.0.0', '2.0.0'])
  })
})
