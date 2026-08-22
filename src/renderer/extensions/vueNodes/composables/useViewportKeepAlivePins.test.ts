import { describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import {
  findLinkDragSourceIds,
  findLiveStateNodeIds,
  useViewportKeepAlivePins
} from '@/renderer/extensions/vueNodes/composables/useViewportKeepAlivePins'

function nodeWith(id: string, contents: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div data-node-id="${id}">${contents}</div>`
  return root
}

describe('findLiveStateNodeIds', () => {
  it('retains iframe and playing-media nodes', () => {
    const root = nodeWith(
      'stateful',
      '<iframe src="about:blank"></iframe><video></video>'
    )
    const video = root.querySelector('video') as HTMLVideoElement
    Object.defineProperty(video, 'paused', { value: false })

    expect(findLiveStateNodeIds(root)).toEqual(new Set(['stateful']))
  })

  it('does not retain idle media or ordinary widgets', () => {
    const root = nodeWith('idle', '<video></video><textarea></textarea>')

    expect(findLiveStateNodeIds(root)).toEqual(new Set())
  })
})

describe('findLinkDragSourceIds', () => {
  it('retains only sources from a link drag in flight', () => {
    const connector = {
      isConnecting: true,
      renderLinks: [{ node: { id: 'source' } }, { node: { id: 7 } }]
    }

    expect(findLinkDragSourceIds(connector)).toEqual(new Set(['source', '7']))
    expect(
      findLinkDragSourceIds({ ...connector, isConnecting: false })
    ).toEqual(new Set())
  })
})

describe('useViewportKeepAlivePins', () => {
  it('retains and releases nodes with transient browser state', async () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div data-node-id="focused"><input /></div>
      <div data-node-id="playing"><video /></div>
    `
    document.body.appendChild(root)

    const scope = effectScope()
    try {
      const video = root.querySelector('video')
      if (!(video instanceof HTMLVideoElement)) {
        throw new Error('Test fixture is missing a video element')
      }
      Object.defineProperty(video, 'paused', {
        configurable: true,
        value: false
      })

      const connector = new LinkConnector(() => {})
      connector.state.connectingTo = 'input'
      Object.defineProperty(connector, 'renderLinks', {
        value: [{ node: { id: 'link-source' } }]
      })

      const { pinnedNodeIds } = scope.run(() =>
        useViewportKeepAlivePins({
          getRoot: () => root,
          getLinkConnector: () => connector
        })
      )!

      const input = root.querySelector('input')
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('Test fixture is missing an input element')
      }
      input.focus()
      connector.events.dispatch('drag-started', undefined)
      await nextTick()

      expect(pinnedNodeIds.value).toEqual(
        new Set(['focused', 'playing', 'link-source'])
      )

      input.blur()
      video.remove()
      connector.state.connectingTo = undefined
      connector.events.dispatch('reset', true)
      await nextTick()

      // Every pin is transient by construction, so with all three released the
      // set is empty. Selection is deliberately not a pin: it is the one input
      // that can be graph-sized, and a detached node keeps its selection state.
      expect(pinnedNodeIds.value).toEqual(new Set())
    } finally {
      scope.stop()
      root.remove()
    }
  })
})
