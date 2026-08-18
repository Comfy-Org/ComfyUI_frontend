import { describe, expect, it } from 'vitest'

import {
  findLinkDragSourceIds,
  findLiveStateNodeIds
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
