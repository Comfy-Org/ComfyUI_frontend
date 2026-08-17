import { describe, expect, it } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { NodeId } from '@/renderer/core/layout/types'
import {
  findLinkDragSourceIds,
  findNodesOptedOutOfCulling,
  findNodesWithLiveState
} from '@/renderer/extensions/vueNodes/composables/liveNodeState'
import * as liveNodeState from '@/renderer/extensions/vueNodes/composables/liveNodeState'

function mountNode(id: string, inner: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div data-node-id="${id}">${inner}</div>`
  return root
}

function node(id: string, widgets?: VueNodeData['widgets']): VueNodeData {
  return {
    id: id as NodeId,
    title: id,
    type: 'test',
    mode: 0,
    selected: false,
    executing: false,
    widgets
  }
}

describe('findNodesWithLiveState', () => {
  it('reports a node containing an iframe', () => {
    const root = mountNode('embed', '<iframe src="about:blank"></iframe>')

    expect(findNodesWithLiveState(root)).toEqual(new Set(['embed']))
  })

  it('reports a node whose media is playing', () => {
    const root = mountNode('player', '<video></video>')
    const video = root.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'paused', { value: false })
    Object.defineProperty(video, 'currentTime', { value: 12 })

    expect(findNodesWithLiveState(root)).toEqual(new Set(['player']))
  })

  it('reports media playing from time zero', () => {
    // Playback starts at zero, and a seek to zero is still playback.
    const root = mountNode('starting', '<video></video>')
    const video = root.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'paused', { value: false })
    Object.defineProperty(video, 'currentTime', { value: 0 })

    expect(findNodesWithLiveState(root)).toEqual(new Set(['starting']))
  })

  it('ignores idle media, which rebuilds from its source', () => {
    const root = mountNode('idle', '<video></video>')

    expect(findNodesWithLiveState(root)).toEqual(new Set())
  })

  it('ignores media that has finished playing', () => {
    const root = mountNode('finished', '<video></video>')
    const video = root.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'paused', { value: false })
    Object.defineProperty(video, 'ended', { value: true })

    expect(findNodesWithLiveState(root)).toEqual(new Set())
  })

  it('does not report a plain prompt textarea', () => {
    // The rule this replaces pinned every node with a legacy DOM widget, which
    // is 40% of a standard workflow - all of them prompt textareas. Their value
    // survives a remount; the focus pin covers the one being typed in.
    const root = mountNode('prompt', '<textarea>a prompt</textarea>')

    expect(findNodesWithLiveState(root)).toEqual(new Set())
  })
})

describe('findLinkDragSourceIds', () => {
  it('reports the source node of a link drag in flight', () => {
    // Unmounting it removes the slot element the gesture started from, and
    // reaching toward an off-screen target is exactly what makes the user pan
    // far enough for that to happen.
    const connector = {
      isConnecting: true,
      renderLinks: [{ node: { id: 'source' } }, { node: { id: 7 } }]
    }

    expect(findLinkDragSourceIds(connector)).toEqual(new Set(['source', '7']))
  })

  it('is empty when no drag is in flight', () => {
    // renderLinks is not emptied on reset, so the connecting flag is what
    // decides; reading the array alone would pin the last drag forever.
    const connector = {
      isConnecting: false,
      renderLinks: [{ node: { id: 'stale' } }]
    }

    expect(findLinkDragSourceIds(connector)).toEqual(new Set())
  })

  it('tolerates a missing connector or node', () => {
    expect(findLinkDragSourceIds(undefined)).toEqual(new Set())
    expect(
      findLinkDragSourceIds({ isConnecting: true, renderLinks: [{}] })
    ).toEqual(new Set())
  })
})

describe('findNodesOptedOutOfCulling', () => {
  it('is empty while no node type is excluded', () => {
    // The registry is deliberately empty: the opt-out is internal so it cannot
    // reach `LGraphNode.serialize` and become permanent workflow JSON. This
    // pins that nothing is excluded by default, so adding an entry is a
    // visible decision rather than a silent one.
    expect(findNodesOptedOutOfCulling([node('a'), node('b')])).toEqual(
      new Set()
    )
  })

  it('registers a node-type opt-out with lifecycle cleanup', () => {
    type RegisterOptOut = (nodeType: string) => () => void
    const candidate = Reflect.get(
      liveNodeState,
      'registerNodeTypeCullingOptOut'
    )
    expect(candidate).toBeTypeOf('function')
    if (typeof candidate !== 'function') return

    const cleanup = (candidate as RegisterOptOut)('stateful')
    const statefulNode = { ...node('stateful'), type: 'stateful' }

    expect(findNodesOptedOutOfCulling([statefulNode])).toEqual(
      new Set(['stateful'])
    )

    cleanup()
    expect(findNodesOptedOutOfCulling([statefulNode])).toEqual(new Set())
  })
})
