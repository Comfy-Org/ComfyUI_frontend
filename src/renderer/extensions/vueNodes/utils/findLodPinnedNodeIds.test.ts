import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { ToInputRenderLink } from '@/lib/litegraph/src/canvas/ToInputRenderLink'
import { findLodPinnedNodeIds } from '@/renderer/extensions/vueNodes/utils/findLodPinnedNodeIds'
import {
  createMockLGraphNode,
  createMockLinkNetwork,
  createMockNodeOutputSlot
} from '@/utils/__tests__/litegraphTestUtils'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

function mountNodes(nodes: Record<string, string>): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = Object.entries(nodes)
    .map(([id, contents]) => `<div data-node-id="${id}">${contents}</div>`)
    .join('')
  return root
}

describe('findLodPinnedNodeIds', () => {
  it.for([
    { name: 'an iframe', contents: '<iframe></iframe>', pinned: true },
    { name: 'idle media', contents: '<video></video>', pinned: false },
    {
      name: 'ordinary widgets',
      contents: '<textarea></textarea>',
      pinned: false
    }
  ])('pins a node holding $name: $pinned', ({ contents, pinned }) => {
    const root = mountNodes({ live: contents, plain: '' })

    expect(findLodPinnedNodeIds(root, null)).toEqual(
      new Set(pinned ? ['live'] : [])
    )
  })

  it('pins a node while its media plays', () => {
    const root = mountNodes({ playing: '<audio></audio>' })
    const audio = root.querySelector('audio')
    assert.exists(audio)
    vi.spyOn(audio, 'paused', 'get').mockReturnValue(false)

    expect(findLodPinnedNodeIds(root, null)).toEqual(new Set(['playing']))
  })

  it('pins the node that holds focus, and only inside the canvas', () => {
    const root = mountNodes({ focused: '<input />', other: '<input />' })
    document.body.appendChild(root)
    onTestFinished(() => root.remove())
    const outside = document.createElement('input')
    document.body.appendChild(outside)
    onTestFinished(() => outside.remove())

    root.querySelector('input')?.focus()
    expect(findLodPinnedNodeIds(root, null)).toEqual(new Set(['focused']))

    outside.focus()
    expect(findLodPinnedNodeIds(root, null)).toEqual(new Set())
  })

  it('pins the source nodes of a link drag', () => {
    const connector = new LinkConnector(() => {})
    const output = createMockNodeOutputSlot()
    const source = createMockLGraphNode({
      id: toNodeId('link-source'),
      outputs: [output],
      getOutputPos: vi.fn(() => [0, 0])
    })
    connector.renderLinks.push(
      new ToInputRenderLink(createMockLinkNetwork(), source, output)
    )
    connector.state.connectingTo = 'input'

    expect(findLodPinnedNodeIds(mountNodes({}), connector)).toEqual(
      new Set(['link-source'])
    )
  })
})
