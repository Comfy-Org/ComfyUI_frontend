import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'

import { createNodeApiHost, useNodeApiHost } from './nodeApiHost'
import type { VersionHost } from './shared/versionHost'
import { publishedApi, withoutPublishedApi } from './v4/__tests__/publishedApi'
import { moduleUrl, TEST_PACK } from './v4/__tests__/testPack'
import { createComfyApi } from './v4/comfyApi'
import { useComfyApiStore } from './v4/comfyApiStore'
import type { Comfy, WorkflowImporter } from './v4/types'

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
    get topbarBadges() {
      return host.topbarBadges.value
    },
    get actionBarButtons() {
      return host.actionBarButtons.value
    },
    provideCanvas: vi.fn(),
    publish: vi.fn(),
    markReady: host.markReady,
    providePacks: host.providePacks,
    endDocument: host.endDocument,
    loadEnded: host.loadEnded,
    beginDocument: host.beginDocument,
    beforeHistoryRestore: host.beforeHistoryRestore,
    afterHistoryRestore: host.afterHistoryRestore,
    workflowLoaded: host.workflowLoaded,
    reapplyTypeColors: host.reapplyTypeColors,
    deliverPreview: host.deliverPreview,
    queue: host.queue,
    importWorkflowFile: host.importWorkflowFile,
    frontendExecution: host.frontendExecution
  }
  return { comfy, version }
}

function importer(id: string, version: number): WorkflowImporter {
  return { id, maxBytes: 1024, parse: () => ({ workflow: { version } }) }
}

describe('the node API host', () => {
  let graph: LGraph
  let current: Comfy
  let later: ReturnType<typeof laterVersion>
  let host: ReturnType<typeof createNodeApiHost>

  beforeEach(() => {
    withoutPublishedApi()
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

  it('gives the canvas to every version and publishes each', () => {
    const source = {
      visibleGraph: () => graph,
      canvas: () => null,
      followMoves: () => () => {},
      followDragEnds: () => () => {}
    }

    host.provideCanvas(source)
    host.publish()

    expect(later.version.provideCanvas).toHaveBeenCalledExactlyOnceWith(source)
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

  it('tells every version a workflow loaded', () => {
    const heard: string[] = []
    current.onWorkflowLoaded(() => heard.push('current'))
    later.comfy.onWorkflowLoaded(() => heard.push('later'))

    host.workflowLoaded()

    expect(heard).toEqual(['current', 'later'])
  })

  it("shows every version's badges and buttons, oldest version first, as they change", () => {
    current.ui.addTopBarBadge({ id: 'Current.badge', text: 'current' })
    const laterBadge = later.comfy.ui.addTopBarBadge({
      id: 'Later.badge',
      text: 'later'
    })
    later.comfy.ui.addActionBarButton({
      id: 'Later.button',
      icon: 'icon-[lucide--camera]',
      label: 'Later',
      run: () => {}
    })

    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual([
      'current',
      'later'
    ])
    expect(host.actionBarButtons.value.map(({ label }) => label)).toEqual([
      'Later'
    ])

    laterBadge.remove()

    expect(host.topbarBadges.value.map(({ text }) => text)).toEqual(['current'])
  })

  it('keeps the workflow the first version that reads a file finds', async () => {
    const file = new File(['bytes'], 'a.bin')
    const unregister = current.workflow.registerImporter(
      importer('Current.reader', 1)
    )
    later.comfy.workflow.registerImporter(importer('Later.reader', 2))

    expect(await host.importWorkflowFile(file, undefined)).toEqual({
      workflow: { version: 1 }
    })

    unregister()

    expect(await host.importWorkflowFile(file, undefined)).toEqual({
      workflow: { version: 2 }
    })
  })

  it('hands a file that already holds a workflow back untouched', async () => {
    const found = { workflow: { version: 0.4 } }
    const parse = vi.fn()
    later.comfy.workflow.registerImporter({
      id: 'Later.reader',
      maxBytes: 1024,
      parse
    })

    expect(await host.importWorkflowFile(new File([''], 'a.png'), found)).toBe(
      found
    )
    expect(parse).not.toHaveBeenCalled()
  })

  it.for([
    { call: 'provideCanvas', args: ['canvas'] },
    { call: 'publish', args: [] },
    { call: 'markReady', args: [] },
    { call: 'providePacks', args: [[]] },
    { call: 'endDocument', args: ['graph'] },
    { call: 'loadEnded', args: [] },
    { call: 'beginDocument', args: [] },
    { call: 'beforeHistoryRestore', args: ['graph', { nodes: [] }] },
    { call: 'afterHistoryRestore', args: [] },
    { call: 'workflowLoaded', args: [] },
    { call: 'reapplyTypeColors', args: [] },
    { call: 'deliverPreview', args: ['root', '3', 'blob'] }
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

  it('hands the queue’s calls and the prompt’s nodes to every version, and leaves out the inputs any of them omits', () => {
    const heard: string[] = []
    const version = (name: string, omitted: string[]) =>
      fromPartial<VersionHost>({
        queue: {
          promptSubmitted: (...args) => heard.push(`${name} ${args.join(' ')}`),
          promptRejected: () => heard.push(`${name} rejected`),
          queueSettled: () => heard.push(`${name} settled`)
        },
        frontendExecution: {
          adoptNodes: () => heard.push(`${name} adopted`),
          omittedInputs: () => omitted
        }
      })
    const fanned = createNodeApiHost([
      version('older', ['a']),
      version('newer', ['b'])
    ])

    fanned.queue.promptSubmitted(1, 'p', 2)
    fanned.queue.promptRejected()
    fanned.queue.queueSettled()
    fanned.frontendExecution.adoptNodes(fromAny(new Map()))

    expect(heard).toEqual([
      'older 1 p 2',
      'newer 1 p 2',
      'older rejected',
      'newer rejected',
      'older settled',
      'newer settled',
      'older adopted',
      'newer adopted'
    ])
    expect(fanned.frontendExecution.omittedInputs(fromAny({}))).toEqual([
      'a',
      'b'
    ])
  })
})
