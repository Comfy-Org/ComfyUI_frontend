import { describe, expect, it } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import type { NodeId } from '@/renderer/core/layout/types'
import {
  DISABLE_CULLING_PROPERTY,
  findNodesOptedOutOfCulling,
  findNodesWithLiveState
} from '@/renderer/extensions/vueNodes/composables/liveNodeState'

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

  it('does not report a plain prompt textarea', () => {
    // The rule this replaces pinned every node with a legacy DOM widget, which
    // is 40% of a standard workflow - all of them prompt textareas. Their value
    // survives a remount; the focus pin covers the one being typed in.
    const root = mountNode('prompt', '<textarea>a prompt</textarea>')

    expect(findNodesWithLiveState(root)).toEqual(new Set())
  })
})

describe('findNodesOptedOutOfCulling', () => {
  it('reports nodes whose author disabled culling', () => {
    const properties: Record<string, Record<string, unknown>> = {
      keep: { [DISABLE_CULLING_PROPERTY]: true },
      normal: {}
    }

    const result = findNodesOptedOutOfCulling(
      [node('keep'), node('normal')],
      (id) => properties[id]
    )

    expect(result).toEqual(new Set(['keep']))
  })

  it('is empty when nothing opts out', () => {
    expect(findNodesOptedOutOfCulling([node('a')], () => ({}))).toEqual(
      new Set()
    )
  })
})
