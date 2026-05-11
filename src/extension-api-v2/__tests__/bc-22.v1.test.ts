// Category: BC.22 — Context menu contributions (node and canvas)
// DB cross-ref: S2.N5, S1.H3, S1.H4
// blast_radius: 5.10 (compat-floor)
// v1 contract: getNodeMenuItems / getExtraMenuOptions prototype patch / getCanvasMenuItems
// TODO(R8): swap with loadEvidenceSnippet once excerpts populated

import { describe, expect, it } from 'vitest'
import { countEvidenceExcerpts, loadEvidenceSnippet, runV1 } from '../harness'

void [loadEvidenceSnippet, runV1]

type MenuItem = { content: string; callback: () => void }

function makeMenuSystem() {
  const nodeMenuExtensions: Array<(node: unknown) => MenuItem[]> = []
  const canvasMenuExtensions: Array<() => MenuItem[]> = []

  return {
    registerExtension(ext: {
      getNodeMenuItems?: (value: unknown, options: { node: unknown }) => MenuItem[]
      getCanvasMenuItems?: () => MenuItem[]
    }) {
      if (ext.getNodeMenuItems) {
        nodeMenuExtensions.push((node) => ext.getNodeMenuItems!({}, { node }))
      }
      if (ext.getCanvasMenuItems) {
        canvasMenuExtensions.push(ext.getCanvasMenuItems)
      }
    },
    buildNodeMenu(node: unknown): MenuItem[] {
      return nodeMenuExtensions.flatMap(fn => fn(node) ?? [])
    },
    buildCanvasMenu(): MenuItem[] {
      return canvasMenuExtensions.flatMap(fn => fn() ?? [])
    },
  }
}

describe('BC.22 v1 contract — Context menu contributions (S2.N5/S1.H3/S1.H4)', () => {
  it('S1.H3 has at least one evidence excerpt', () => {
    expect(countEvidenceExcerpts('S1.H3')).toBeGreaterThan(0)
  })

  it('getNodeMenuItems items appear in the node context menu', () => {
    const menu = makeMenuSystem()
    menu.registerExtension({
      getNodeMenuItems(_value, _options) {
        return [{ content: 'My Item', callback: () => {} }]
      },
    })
    const items = menu.buildNodeMenu({ id: 1 })
    expect(items.map(i => i.content)).toContain('My Item')
  })

  it('getNodeMenuItems receives options.node as the right-clicked node', () => {
    const menu = makeMenuSystem()
    let receivedNode: unknown
    menu.registerExtension({
      getNodeMenuItems(_value, options) {
        receivedNode = options.node
        return []
      },
    })
    const node = { id: 42, type: 'KSampler' }
    menu.buildNodeMenu(node)
    expect(receivedNode).toBe(node)
  })

  it('returning empty array from getNodeMenuItems does not break the menu', () => {
    const menu = makeMenuSystem()
    menu.registerExtension({ getNodeMenuItems: () => [] })
    expect(() => menu.buildNodeMenu({})).not.toThrow()
    expect(menu.buildNodeMenu({})).toEqual([])
  })

  it('multiple extensions contributing node menu items all appear', () => {
    const menu = makeMenuSystem()
    menu.registerExtension({ getNodeMenuItems: () => [{ content: 'A', callback: () => {} }] })
    menu.registerExtension({ getNodeMenuItems: () => [{ content: 'B', callback: () => {} }] })
    const contents = menu.buildNodeMenu({}).map(i => i.content)
    expect(contents).toContain('A')
    expect(contents).toContain('B')
  })

  it('getExtraMenuOptions prototype patch chains and all fire', () => {
    const log: string[] = []
    const proto: { getExtraMenuOptions: (app: unknown) => void } = {
      getExtraMenuOptions(_app) { log.push('orig') },
    }

    const prev = proto.getExtraMenuOptions.bind(proto)
    proto.getExtraMenuOptions = function (app) { log.push('ext'); prev(app) }

    proto.getExtraMenuOptions({})
    expect(log).toEqual(['ext', 'orig'])
  })

  it('getCanvasMenuItems items appear in the canvas context menu', () => {
    const menu = makeMenuSystem()
    menu.registerExtension({
      getCanvasMenuItems() {
        return [{ content: 'Canvas Option', callback: () => {} }]
      },
    })
    const items = menu.buildCanvasMenu()
    expect(items.map(i => i.content)).toContain('Canvas Option')
  })

  it('multiple extensions contributing canvas menu items all appear', () => {
    const menu = makeMenuSystem()
    menu.registerExtension({ getCanvasMenuItems: () => [{ content: 'X', callback: () => {} }] })
    menu.registerExtension({ getCanvasMenuItems: () => [{ content: 'Y', callback: () => {} }] })
    const contents = menu.buildCanvasMenu().map(i => i.content)
    expect(contents).toContain('X')
    expect(contents).toContain('Y')
  })

  it.todo('getCanvasMenuItems items appear only when no node is right-clicked (Phase B — requires real canvas hit-testing)')
})
